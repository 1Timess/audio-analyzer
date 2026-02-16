import io
import base64
import numpy as np
import torch
from pydub import AudioSegment
from scipy.signal import find_peaks, butter, filtfilt
from scipy.cluster.vq import kmeans2, whiten

# NEW: silhouette-based k selection
from sklearn.metrics import silhouette_score

# -----------------------------
# Model loading (once)
# -----------------------------

vad_model, vad_utils = torch.hub.load(
    "snakers4/silero-vad",
    "silero_vad",
    trust_repo=True
)

get_speech_timestamps = vad_utils[0]

# -----------------------------
# Small utils
# -----------------------------

def clamp01(x: float) -> float:
    return float(np.clip(x, 0.0, 1.0))

def direction_from_balance(balance_val: float) -> str:
    # balance_val expected in [-1, 1]
    if balance_val < -0.2:
        return "left"
    if balance_val > 0.2:
        return "right"
    return "center"

def estimate_direction_confidence(balance_val: float, rms: float, duration: float, channels: int) -> float:
    """
    Direction confidence:
    - If mono: we cannot infer direction, so keep it deliberately low (but non-zero)
      to signal "heuristic placeholder" without pretending it's accurate.
    - If stereo: use balance strength + loudness + duration.
    """
    if channels != 2:
        loudness = clamp01((rms - 0.012) / 0.06)
        dur = clamp01((duration - 0.25) / 1.25)
        return clamp01(0.05 + 0.10 * loudness + 0.05 * dur)  # capped low

    bal_strength = clamp01((abs(balance_val) - 0.05) / 0.35)
    loudness = clamp01((rms - 0.01) / 0.06)
    dur = clamp01((duration - 0.25) / 1.0)
    return clamp01(0.55 * bal_strength + 0.30 * loudness + 0.15 * dur)

def estimate_distance_bucket_ft(rms: float, channels: int):
    """
    Rough distance estimate from RMS loudness (very heuristic).
    This is NOT physically accurate; it exists to demonstrate future capability and provide a best-effort hint.

    Returns:
      (label: str, range_ft: dict{min,max}, confidence: float, note: str)
    """
    if rms is None or not np.isfinite(rms) or rms <= 0:
        return ("unknown", {"min": None, "max": None}, 0.0, "insufficient signal")

    # Calibration constant (tweak later using known reference recordings).
    # This assumes ~0.06 RMS is "about 3 ft" for a typical voice in a typical room.
    rms_ref_at_3ft = 0.06

    # crude inverse-ish model: d_ft ~ 3 * sqrt(rms_ref / rms)
    d_ft = 3.0 * float(np.sqrt(max(rms_ref_at_3ft, 1e-6) / max(rms, 1e-6)))

    buckets = [
        (0, 5),
        (5, 10),
        (10, 15),
        (15, 25),
        (25, 50),
        (50, 999),
    ]

    label = "unknown"
    rng = {"min": None, "max": None}
    for lo, hi in buckets:
        if lo <= d_ft < hi:
            label = f"{lo}–{hi if hi < 999 else '+'} ft"
            rng = {"min": lo, "max": None if hi >= 999 else hi}
            break

    # Keep confidence low by design; downweight further for mono.
    loudness = clamp01((rms - 0.015) / 0.06)
    conf = 0.10 + 0.35 * loudness
    if channels != 2:
        conf *= 0.55

    note = "heuristic (loudness-based)"
    if channels != 2:
        note += "; mono input limits spatial inference"

    return (label, rng, float(clamp01(conf)), note)

# -----------------------------
# Audio loading
# -----------------------------

def load_audio(file_bytes: bytes):
    audio = AudioSegment.from_file(io.BytesIO(file_bytes))
    audio = (
        audio
        .set_frame_rate(16000)
        .set_sample_width(2)
        # Preserve stereo if present; otherwise mono.
        .set_channels(2 if audio.channels == 2 else 1)
    )

    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)

    if audio.channels == 2:
        samples = samples.reshape(-1, 2)
    else:
        samples = samples.reshape(-1, 1)

    samples /= 32768.0
    return samples, audio.frame_rate, audio.channels

# -----------------------------
# Feature helpers
# -----------------------------

def bandpass_filter(x, sr, low=70, high=350):
    b, a = butter(4, [low / (sr / 2), high / (sr / 2)], btype="band")
    return filtfilt(b, a, x)

def estimate_pitch(seg, sr, fmin=70.0, fmax=300.0):
    mono = seg.mean(axis=1).astype(np.float32)
    mono -= float(mono.mean())

    # Need enough samples for low pitches (at least a few periods of ~70 Hz)
    if len(mono) < int(sr * 0.12):  # ~120ms
        return None

    # Bandpass only if the segment is long enough for filtfilt to behave
    try:
        mono = bandpass_filter(mono, sr, low=fmin, high=fmax)
    except Exception:
        return None

    # Autocorrelation (biased but OK for this use)
    corr = np.correlate(mono, mono, mode="full")[len(mono)-1:]

    # Limit lag search to F0 range
    min_lag = int(sr / fmax)
    max_lag = int(sr / fmin)
    if max_lag <= min_lag + 2 or max_lag >= len(corr):
        return None

    corr_slice = corr[min_lag:max_lag]

    # Optional: ignore tiny signals / flat correlation
    if not np.isfinite(corr_slice).all() or np.max(corr_slice) <= 0:
        return None

    peak_lag = int(np.argmax(corr_slice)) + min_lag
    pitch = sr / peak_lag if peak_lag > 0 else None

    if pitch and fmin <= pitch <= fmax:
        return float(pitch)
    return None

def estimate_syllables(seg, sr):
    mono = seg.mean(axis=1)
    rms = np.sqrt(np.mean(mono ** 2))
    if rms < 0.02:
        return 0

    env = np.abs(mono)
    env = np.convolve(env, np.ones(int(sr * 0.01)) / int(sr * 0.01), mode="same")
    peaks, _ = find_peaks(env, height=max(0.02, rms * 0.5), distance=sr * 0.05)
    return len(peaks)

# --- Speaker grouping helpers (heuristic, NOT demographics) ---

def pitch_bucket(p):
    if p is None:
        return ("unknown", 0.0)
    if p < 110:
        return ("low", 0.6)
    if p < 180:
        return ("mid", 0.6)
    return ("high", 0.6)

def tempo_bucket(r):
    if r is None or not np.isfinite(r):
        return ("unknown", 0.0)
    if r < 4.5:
        return ("slow", 0.55)
    if r < 6.5:
        return ("medium", 0.55)
    return ("fast", 0.55)

def spectral_centroid(mono: np.ndarray, sr: int) -> float:
    mono = mono.astype(np.float32)
    if mono.size == 0:
        return 0.0
    mono = mono - float(mono.mean())
    win = np.hanning(len(mono)).astype(np.float32)
    x = mono * win
    spec = np.abs(np.fft.rfft(x))
    freqs = np.fft.rfftfreq(len(x), d=1.0 / sr)
    mag_sum = float(np.sum(spec)) + 1e-9
    return float(np.sum(freqs * spec) / mag_sum)

def spectral_rolloff(mono: np.ndarray, sr: int, roll_percent: float = 0.85) -> float:
    mono = mono.astype(np.float32)
    if mono.size == 0:
        return 0.0
    mono = mono - float(mono.mean())
    win = np.hanning(len(mono)).astype(np.float32)
    x = mono * win
    spec = np.abs(np.fft.rfft(x))
    freqs = np.fft.rfftfreq(len(x), d=1.0 / sr)
    cumsum = np.cumsum(spec)
    total = float(cumsum[-1]) + 1e-9
    threshold = roll_percent * total
    idx = int(np.searchsorted(cumsum, threshold))
    idx = min(max(idx, 0), len(freqs) - 1)
    return float(freqs[idx])

def segment_voice_features(seg_samples: np.ndarray, sr: int, pitch_hz, rms: float, syllable_rate: float):
    mono = seg_samples.mean(axis=1).astype(np.float32)
    sc = spectral_centroid(mono, sr)
    ro = spectral_rolloff(mono, sr, 0.85)

    p = float(pitch_hz) if pitch_hz is not None else 0.0
    has_pitch = 1.0 if pitch_hz is not None else 0.0

    # Feature vector: [pitch, has_pitch, rms, tempo-ish, brightness, rolloff]
    return np.array([p, has_pitch, float(rms), float(syllable_rate), sc, ro], dtype=np.float32)

def choose_k(num_segments: int) -> int:
    # Conservative to avoid silly speaker counts on short clips
    if num_segments < 4:
        return 1
    if num_segments < 10:
        return 2
    if num_segments < 20:
        return 3
    return 4

# -----------------------------
# NEW: data-driven k selection w/ guardrails
# -----------------------------

def pick_k_silhouette(
    Xw: np.ndarray,
    num_segments: int,
    min_cluster_size: int = 2,
    min_improvement: float = 0.04,
    quality_floor: float = 0.20,
    hard_k_max: int = 8,
):
    """
    Choose k by silhouette score, but only increase k when there's meaningful improvement.
    Also prevents cluster explosion via min cluster size + hard cap.
    Returns: (k: int, meta: dict)
    """
    n = int(num_segments)
    if n < 4:
        return 1, {"method": "silhouette", "reason": "too_few_segments", "k": 1}

    # Dynamic cap: avoid high k when you don't have enough segments.
    k_max = min(hard_k_max, max(2, n // min_cluster_size))
    # Extra conservative: you generally want at least ~3 segments per cluster
    k_max = min(k_max, max(2, n // 3))

    if k_max < 2:
        return 1, {"method": "silhouette", "reason": "k_max<2", "k": 1}

    best_k = 1
    best_score = -1.0
    accepted_prev = None
    tried = []

    for k in range(2, k_max + 1):
        try:
            _, labels = kmeans2(Xw, k, minit="points")
        except Exception:
            tried.append({"k": k, "ok": False, "why": "kmeans_error"})
            continue

        counts = np.bincount(labels, minlength=k)
        if np.any(counts < min_cluster_size):
            tried.append({"k": k, "ok": False, "why": "min_cluster_size"})
            continue

        if len(set(labels.tolist())) < 2:
            tried.append({"k": k, "ok": False, "why": "degenerate_labels"})
            continue

        try:
            score = float(silhouette_score(Xw, labels, metric="euclidean"))
        except Exception:
            tried.append({"k": k, "ok": False, "why": "silhouette_error"})
            continue

        tried.append({"k": k, "ok": True, "score": score})

        # Only "accept" increases if the improvement is meaningful
        if accepted_prev is None or (score - accepted_prev) >= min_improvement:
            if score > best_score:
                best_score = score
                best_k = k
                accepted_prev = score

    # If the best separation is weak, don't pretend grouping is meaningful.
    if best_k >= 2 and best_score < quality_floor:
        return 1, {
            "method": "silhouette",
            "reason": "quality_floor",
            "k": 1,
            "best_score": best_score,
            "k_max": k_max,
            "tried": tried,
        }

    return best_k, {
        "method": "silhouette",
        "reason": "selected",
        "k": best_k,
        "best_score": best_score,
        "k_max": k_max,
        "tried": tried,
    }

# -----------------------------
# Segment analysis
# -----------------------------

def analyze_segments(samples, sr, channels):
    wav = torch.from_numpy(samples.mean(axis=1)).float()
    timestamps = get_speech_timestamps(wav, vad_model, sampling_rate=sr)

    segments = []
    syllable_rates = []
    voice_feats = []

    for seg in timestamps:
        start, end = seg["start"], seg["end"]
        seg_samples = samples[start:end]
        duration = (end - start) / sr

        if duration < 0.2:
            continue

        rms = float(np.sqrt(np.mean(seg_samples ** 2)))
        syllables = estimate_syllables(seg_samples, sr)
        rate = syllables / max(duration, 1e-3)
        pitch = estimate_pitch(seg_samples, sr)

        if rate > 0:
            syllable_rates.append(rate)

        # Balance / direction (meaningful only if stereo)
        if channels == 2:
            l = np.mean(seg_samples[:, 0] ** 2)
            r = np.mean(seg_samples[:, 1] ** 2)
            balance_val = (r - l) / (r + l + 1e-9)
            direction = direction_from_balance(balance_val)
            balance = direction  # keep old field aligned
        else:
            balance_val = 0.0
            direction = "unknown"   # don't pretend "center" in mono
            balance = "center"      # keep old field stable for UI/back-compat

        # Speech/segment confidence (existing)
        confidence = float(
            np.clip(seg.get("speech_prob", 0.7) * 0.6 + min(rms / 0.2, 1.0) * 0.4, 0, 1)
        )

        # New: direction confidence + distance estimate (heuristic)
        direction_conf = estimate_direction_confidence(balance_val, rms, duration, channels)
        dist_label, dist_range, dist_conf, dist_note = estimate_distance_bucket_ft(rms, channels)

        # Speaker grouping feature vector (heuristic; not demographics)
        vf = segment_voice_features(seg_samples, sr, pitch, rms, rate)
        voice_feats.append(vf)

        segments.append({
            "start": start / sr,
            "end": end / sr,
            "duration": duration,
            "rms": rms,
            "pitch_hz": pitch,
            "syllable_rate": rate,
            "confidence": confidence,

            # Existing fields
            "balance": balance,
            "balance_val": float(balance_val),

            # Spatial fields
            "direction": direction,
            "direction_confidence": float(direction_conf),
            "distance_label": dist_label,
            "distance_estimate_ft": dist_range,
            "distance_confidence": float(dist_conf),
            "spatial_note": dist_note,

            "clip_base64": encode_clip(seg_samples, sr, channels),
        })

    rhythm = estimate_rhythm(syllable_rates)
    for s in segments:
        s["rhythm_estimate"] = rhythm

    # -----------------------------
    # Speaker grouping (k-means clustering)
    # -----------------------------
    speaker_profiles = []
    if len(segments) >= 2:
        X = np.vstack(voice_feats)

        # Normalize feature scales for kmeans
        try:
            Xw = whiten(X)
        except Exception:
            Xw = X

        # OLD: k = choose_k(len(segments))
        # NEW: silhouette-based selection w/ guardrails
        k, grouping_meta = pick_k_silhouette(
            Xw,
            num_segments=len(segments),
            min_cluster_size=2,
            min_improvement=0.04,
            quality_floor=0.20,
            hard_k_max=8,
        )

        # In rare cases, kmeans2 can error if data is degenerate; guard it.
        try:
            _, labels = kmeans2(Xw, k, minit="points")
        except Exception:
            labels = np.zeros((len(segments),), dtype=np.int32)
            grouping_meta = {
                "method": "silhouette",
                "reason": "kmeans_error_fallback",
                "k": 1,
            }

        for i, s in enumerate(segments):
            s["speaker_id"] = int(labels[i])

        for sid in sorted(set(labels.tolist())):
            idxs = [i for i, lab in enumerate(labels) if lab == sid]
            if not idxs:
                continue

            pitches = [segments[i]["pitch_hz"] for i in idxs if segments[i]["pitch_hz"] is not None]
            rates = [segments[i]["syllable_rate"] for i in idxs if np.isfinite(segments[i]["syllable_rate"])]

            pitch_med = float(np.median(pitches)) if pitches else None
            rate_med = float(np.median(rates)) if rates else None

            pb, _ = pitch_bucket(pitch_med)
            tb, _ = tempo_bucket(rate_med)

            voiced_ratio = (len(pitches) / max(1, len(idxs)))
            dur_sum = float(sum(segments[i]["duration"] for i in idxs))

            # Confidence: more evidence + more voiced frames = more reliable grouping
            conf = clamp01(
                0.15
                + 0.35 * clamp01((len(idxs) - 1) / 6.0)
                + 0.35 * float(voiced_ratio)
                + 0.15 * clamp01(dur_sum / 10.0)
            )

            speaker_profiles.append({
                "speaker_id": int(sid),
                "label": f"Speaker {int(sid) + 1}",
                "segments": int(len(idxs)),
                "total_duration_s": dur_sum,
                "median_pitch_hz": pitch_med,
                "pitch_bucket": pb,                 # low / mid / high / unknown
                "median_syllable_rate": rate_med,
                "tempo_bucket": tb,                 # slow / medium / fast / unknown
                "confidence": float(conf),
                "note": "Voice grouping is heuristic; not a biometric identification.",
            })

    return segments, speaker_profiles

# -----------------------------
# Rhythm
# -----------------------------

def estimate_rhythm(rates):
    if len(rates) < 3:
        return "Unclear"
    avg, std = np.mean(rates), np.std(rates)
    if avg >= 6.3 and std < 1.2:
        return "Romance-like"
    if avg < 5.2:
        return "Stress-timed"
    return "Mixed"

# -----------------------------
# Audio export
# -----------------------------

def encode_clip(samples, sr, channels):
    pcm16 = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    audio = AudioSegment(
        pcm16.tobytes(),
        frame_rate=sr,
        sample_width=2,
        channels=channels
    )
    buf = io.BytesIO()
    audio.export(buf, format="wav")
    return "data:audio/wav;base64," + base64.b64encode(buf.getvalue()).decode()

# -----------------------------
# Public API
# -----------------------------

def analyze_audio(file_bytes: bytes):
    samples, sr, channels = load_audio(file_bytes)
    segments, speaker_profiles = analyze_segments(samples, sr, channels)
    return {
        "sample_rate": sr,
        "channels": channels,
        "segments": segments,
        "speaker_profiles": speaker_profiles
    }