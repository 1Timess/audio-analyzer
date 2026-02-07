// src/components/Key.jsx

export default function Key() {
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-800/40 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Key</h2>
          <p className="mt-1 text-sm text-zinc-400">
            What the analyzer metrics mean.
          </p>
        </div>

        <span className="inline-flex items-center rounded-full border border-zinc-600/40 bg-zinc-900/40 px-2.5 py-1 text-xs font-medium text-zinc-200">
          Quick reference
        </span>
      </div>

      <div className="mt-6 space-y-5">
        <KeyItem
          label="Sample Rate (Hz)"
          description="How many audio samples per second the analyzer is using. This affects frequency detail and the maximum representable frequency (Nyquist)."
          tips={[
            "16,000 Hz is common for speech models (fast + accurate for voice).",
            "Max representable frequency ≈ sample_rate / 2 (16k → ~8k).",
            "This is not the same as pitch.",
          ]}
        />

        <KeyItem
          label="Channels"
          description="How many audio channels were processed (mono = 1, stereo = 2). Stereo allows left/right balance and direction estimation."
          tips={[
            "Mono: direction is usually “unknown” and confidence stays low.",
            "Stereo: direction and balance are based on left vs right energy.",
          ]}
        />

        <KeyItem
          label="Segments"
          description="Detected speech regions (start/end times) from voice activity detection (VAD). Each segment gets metrics like RMS, pitch, tempo, and confidence."
          tips={[
            "Short segments may skip pitch if too brief or unvoiced.",
            "More segments usually improves Rhythm Estimate stability.",
          ]}
        />

        <KeyItem
          label="Confidence"
          description="Overall “speech segment” confidence. Higher means the segment is more likely to contain clear speech (not noise or silence)."
          tips={[
            "0–40%: weak/uncertain",
            "40–70%: usable",
            "70%+: strong",
          ]}
        />

        <KeyItem
          label="RMS"
          description="Average loudness/energy of the segment. Higher RMS usually means a louder source or closer microphone — but room acoustics and automatic gain control can affect it."
          tips={[
            "Very low RMS often means faint speech or background noise.",
            "Use together with Distance confidence (if shown).",
          ]}
        />

        <KeyItem
          label="Pitch (Hz)"
          description="Estimated fundamental frequency of the voice (if detectable). This is a best-effort estimate and may be missing for noisy or very short segments."
          tips={[
            "Typical adult range ~85–255 Hz (varies a lot).",
            "Higher isn’t “better” — it’s just different voices.",
          ]}
        />

        <KeyItem
          label="Syllable Rate"
          description="Estimated syllables per second (heuristic). Useful for a quick read on speech tempo, not a perfect linguistic measurement."
          tips={[
            "Fast speech tends to show higher values.",
            "Noise can inflate this sometimes.",
          ]}
        />

        <KeyItem
          label="Direction"
          description="Where the sound appears to come from (left / center / right). With mono audio this is usually “unknown” and confidence stays low."
          tips={[
            "Stereo/multi-mic input improves this.",
            "Direction confidence shows how reliable the guess is.",
          ]}
        />

        <KeyItem
          label="Distance"
          description="A rough distance bucket (e.g., 5–10 ft) estimated from loudness. This is intentionally low-confidence unless calibrated for your environment."
          tips={[
            "Affected by speaker volume and room acoustics.",
            "Distance confidence indicates stability of the estimate.",
          ]}
        />

        <KeyItem
          label="Rhythm Estimate"
          description="A high-level rhythm classification based on syllable-rate patterns across segments. This is a lightweight heuristic."
          tips={[
            "Best with multiple segments.",
            "Treat as a hint, not a diagnosis.",
          ]}
        />
      </div>

      <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
        <p className="text-sm text-zinc-300">
          Tip: Use the <span className="font-semibold text-white">meters</span>{" "}
          as reliability indicators. If confidence is low, treat the label as a
          “best guess,” not a fact.
        </p>
      </div>
    </div>
  )
}

function KeyItem({ label, description, tips }) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        </div>

        <span className="shrink-0 inline-flex items-center rounded-full border border-zinc-600/40 bg-zinc-950/30 px-2.5 py-1 text-xs font-medium text-zinc-200">
          Info
        </span>
      </div>

      {Array.isArray(tips) && tips.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-zinc-300">
          {tips.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-500" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}