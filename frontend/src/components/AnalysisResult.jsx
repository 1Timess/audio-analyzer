import { useMemo, useState } from "react"

export default function AnalysisResult({ result }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [speakerFilter, setSpeakerFilter] = useState("all") // "all" | number

  const segmentsRaw = Array.isArray(result?.segments) ? result.segments : []
  const speakerProfiles = Array.isArray(result?.speaker_profiles) ? result.speaker_profiles : []

  // If a speaker filter is applied, show only those segments
  const segments = useMemo(() => {
    if (speakerFilter === "all") return segmentsRaw
    const sid = Number(speakerFilter)
    if (!Number.isFinite(sid)) return segmentsRaw
    return segmentsRaw.filter((s) => Number(s?.speaker_id) === sid)
  }, [segmentsRaw, speakerFilter])

  const active = segments[activeIdx] ?? null

  const duration = useMemo(() => {
    if (typeof result?.duration === "number") return result.duration
    if (segmentsRaw.length) return Math.max(...segmentsRaw.map((s) => Number(s.end) || 0))
    return null
  }, [result?.duration, segmentsRaw])

  const rhythm = useMemo(() => segmentsRaw?.[0]?.rhythm_estimate ?? null, [segmentsRaw])

  const speakersCount = useMemo(() => {
    if (speakerProfiles.length) return speakerProfiles.length
    const ids = new Set(segmentsRaw.map((s) => Number(s?.speaker_id)).filter((n) => Number.isFinite(n)))
    return ids.size
  }, [speakerProfiles, segmentsRaw])

  // Keep activeIdx valid if filter reduces segment list
  useMemo(() => {
    if (activeIdx >= segments.length) setActiveIdx(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length])

  return (
    <div className="mt-6 rounded-3xl border border-zinc-700/60 bg-gradient-to-b from-zinc-900/70 via-zinc-900/55 to-zinc-950/60 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.35)] ring-1 ring-white/5">
      {/* Glow accents */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Analysis</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Segments, confidence, direction, distance, speaker grouping, and playback snippets.
          </p>
        </div>

        <div className="flex gap-2">
          <DownloadButton
            filename="analysis.json"
            mime="application/json"
            content={JSON.stringify(result, null, 2)}
            label="Download JSON"
            variant="secondary"
          />
        </div>
      </div>

      <Divider />

      {/* Overview */}
      <Section title="Overview">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat label="Duration" value={duration != null ? `${duration.toFixed(2)}s` : "—"} />
          <Stat label="Sample Rate" value={result?.sample_rate ? `${result.sample_rate} Hz` : "—"} />
          <Stat label="Channels" value={result?.channels ?? "—"} />
          <Stat label="Segments" value={segmentsRaw.length} />
          <Stat label="Speakers" value={speakersCount || "—"} />
        </div>

        {rhythm && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-700/70 bg-gradient-to-r from-zinc-950/55 to-zinc-900/35 px-4 py-3 shadow-sm ring-1 ring-white/5">
            <div className="text-sm text-zinc-300">
              <span className="text-zinc-400">Rhythm estimate:</span>{" "}
              <span className="font-semibold text-white">{rhythm}</span>
            </div>
            <Badge tone="neutral">Heuristic</Badge>
          </div>
        )}
      </Section>

      {/* Speaker profiles */}
      <Section
        title="Speaker Profiles"
        subtitle={
          speakerProfiles.length
            ? "Heuristic voice grouping. Not a biometric identification."
            : "No speaker grouping available."
        }
      >
        {speakerProfiles.length === 0 ? (
          <EmptyStateCustom
            title="No speaker profiles"
            subtitle="Run analysis on a clip with multiple speech segments to surface grouping."
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                active={speakerFilter === "all"}
                onClick={() => setSpeakerFilter("all")}
                label="All speakers"
              />
              {speakerProfiles
                .slice()
                .sort((a, b) => Number(a.speaker_id) - Number(b.speaker_id))
                .map((sp) => (
                  <FilterChip
                    key={sp.speaker_id}
                    active={speakerFilter === sp.speaker_id}
                    onClick={() => setSpeakerFilter(sp.speaker_id)}
                    label={sp.label ?? `Speaker ${Number(sp.speaker_id) + 1}`}
                    meta={`${sp.segments ?? 0} seg`}
                  />
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {speakerProfiles
                .slice()
                .sort((a, b) => Number(a.speaker_id) - Number(b.speaker_id))
                .map((sp) => {
                  const conf = Number(sp?.confidence)
                  return (
                    <div
                      key={sp.speaker_id}
                      className="group rounded-3xl border border-zinc-700/70 bg-gradient-to-b from-zinc-950/55 to-zinc-900/30 p-4 shadow-sm ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:border-zinc-600/80 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {sp.label ?? `Speaker ${Number(sp.speaker_id) + 1}`}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {sp.segments ?? 0} segments · {fmtNum2(sp.total_duration_s)}s total
                          </p>
                        </div>
                        <Badge tone="neutral">Heuristic</Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniStat label="Pitch bucket" value={sp.pitch_bucket ?? "unknown"} />
                        <MiniStat
                          label="Median pitch"
                          value={
                            sp.median_pitch_hz != null
                              ? `${Number(sp.median_pitch_hz).toFixed(1)} Hz`
                              : "—"
                          }
                        />
                        <MiniStat label="Tempo bucket" value={sp.tempo_bucket ?? "unknown"} />
                        <MiniStat
                          label="Median syllable rate"
                          value={
                            sp.median_syllable_rate != null
                              ? `${Number(sp.median_syllable_rate).toFixed(2)} /s`
                              : "—"
                          }
                        />
                      </div>

                      <div className="mt-4">
                        <Meter value={conf} label="Grouping confidence" />
                      </div>

                      {sp.note && <p className="mt-3 text-xs text-zinc-500">{sp.note}</p>}
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </Section>

      {/* Segments */}
      <Section
        title="Segments"
        subtitle={
          segments.length
            ? "Click a segment to preview and download its clip."
            : speakerFilter === "all"
              ? "No segments detected."
              : "No segments match this speaker filter."
        }
      >
        {segments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Segment list */}
            <div className="space-y-2">
              <div className="max-h-140 overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(113,113,122,0.55)_transparent]">
                {segments.map((seg, i) => {
                  const start = Number(seg.start)
                  const end = Number(seg.end)
                  const segDur = isFinite(start) && isFinite(end) ? end - start : null
                  const conf = Number(seg.confidence)
                  const direction = normalizeDirection(seg)
                  const directionTone = directionToneFrom(direction)

                  const distanceLabel = seg?.distance_label ?? "unknown"
                  const distanceConf = Number(seg?.distance_confidence)

                  const sid = Number(seg?.speaker_id)
                  const speakerLabel = Number.isFinite(sid) ? `Speaker ${sid + 1}` : null

                  const selected = i === activeIdx

                  return (
                    <button
                      key={i}
                      onClick={() => setActiveIdx(i)}
                      className={[
                        "group relative w-full text-left rounded-2xl border px-4 py-3 transition focus:outline-none focus:ring-2 focus:ring-emerald-400/40",
                        selected
                          ? "border-emerald-400/70 bg-gradient-to-b from-emerald-400/15 to-zinc-950/30 shadow-[0_8px_20px_rgba(16,185,129,0.12)]"
                          : "border-zinc-700/70 bg-zinc-950/35 hover:bg-zinc-950/55 hover:border-zinc-600/80",
                      ].join(" ")}
                    >
                      {/* subtle sheen */}
                      <span
                        className={[
                          "pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition",
                          "bg-gradient-to-r from-white/0 via-white/5 to-white/0",
                          selected ? "opacity-100" : "group-hover:opacity-100",
                        ].join(" ")}
                      />

                      <div className="relative flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            Segment {i + 1}
                            <span className="ml-2 text-zinc-400 font-normal">
                              {isFinite(start) && isFinite(end) ? `${start.toFixed(2)}s → ${end.toFixed(2)}s` : "—"}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                            <span>{segDur != null ? `${segDur.toFixed(2)}s` : "—"}</span>
                            <Dot />
                            {speakerLabel ? (
                              <>
                                <span>{speakerLabel}</span>
                                <Dot />
                              </>
                            ) : null}
                            <span>Dir: {direction}</span>
                            <Dot />
                            <span>Dist: {distanceLabel}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {speakerLabel ? <Badge tone="neutral">{speakerLabel}</Badge> : null}
                            <Badge tone={directionTone}>{direction}</Badge>
                          </div>

                          <div className="flex items-center gap-3">
                            <ConfidencePill value={conf} />
                            <div className="hidden sm:block">
                              <TinyPill label="dir" value={fmtPct(seg?.direction_confidence)} />
                            </div>
                            <div className="hidden sm:block">
                              <TinyPill label="dist" value={fmtPct(distanceConf)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Segment detail */}
            <div className="rounded-3xl border border-zinc-700/70 bg-gradient-to-b from-zinc-950/55 to-zinc-900/25 p-4 shadow-sm ring-1 ring-white/5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {active ? `Segment ${activeIdx + 1}` : "—"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {active
                      ? `${Number(active.start).toFixed(2)}s → ${Number(active.end).toFixed(2)}s`
                      : "Select a segment"}
                  </p>

                  {active?.speaker_id != null && Number.isFinite(Number(active.speaker_id)) && (
                    <div className="mt-2">
                      <Badge tone="neutral">{`Speaker ${Number(active.speaker_id) + 1}`}</Badge>
                    </div>
                  )}
                </div>

                {active?.clip_base64 ? (
                  <DownloadButton
                    filename={`segment-${activeIdx + 1}.wav`}
                    href={active.clip_base64}
                    label="Download WAV"
                    variant="primary"
                  />
                ) : (
                  <Badge tone="neutral">No clip</Badge>
                )}
              </div>

              <div className="mt-4 space-y-4">
                {/* Playback */}
                <Panel title="Playback">
                  {active?.clip_base64 ? (
                    <audio className="mt-2 w-full" controls src={active.clip_base64} />
                  ) : (
                    <p className="mt-2 text-sm text-zinc-400">No audio clip attached for this segment.</p>
                  )}
                </Panel>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Confidence" value={fmtPct(active?.confidence)} />
                  <MiniStat label="RMS" value={fmtNum(active?.rms)} />
                  <MiniStat
                    label="Pitch"
                    value={active?.pitch_hz != null ? `${Number(active.pitch_hz).toFixed(1)} Hz` : "—"}
                  />
                  <MiniStat
                    label="Syllable Rate"
                    value={active?.syllable_rate != null ? `${Number(active.syllable_rate).toFixed(2)} /s` : "—"}
                  />
                </div>

                {/* Spatial */}
                <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/35 p-3 space-y-3 ring-1 ring-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Spatial</p>
                    <Badge tone={directionToneFrom(normalizeDirection(active))}>
                      {normalizeDirection(active)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Distance" value={active?.distance_label ?? "unknown"} />
                    <MiniStat
                      label="Distance Range"
                      value={formatDistanceRange(active?.distance_estimate_ft)}
                    />
                  </div>

                  <Meter value={Number(active?.direction_confidence)} label="Direction confidence" />
                  <Meter value={Number(active?.distance_confidence)} label="Distance confidence" />

                  {active?.spatial_note && (
                    <p className="text-xs text-zinc-500">{active.spatial_note}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Advanced */}
      <Section title="Advanced">
        <details className="group rounded-2xl border border-zinc-700/70 bg-zinc-950/30 p-4 ring-1 ring-white/5">
          <summary className="cursor-pointer select-none text-sm text-zinc-300 hover:text-white">
            Raw backend output
            <span className="ml-2 text-xs text-zinc-500 group-open:hidden">click to expand</span>
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-zinc-300 ring-1 ring-white/5">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </Section>
    </div>
  )
}

/* ----------------- helpers ----------------- */

function normalizeDirection(seg) {
  const d = seg?.direction ?? seg?.balance ?? "unknown"
  if (d === "center" || d === "left" || d === "right" || d === "unknown") return d
  return "unknown"
}

function directionToneFrom(direction) {
  if (direction === "left") return "left"
  if (direction === "right") return "right"
  if (direction === "center") return "center"
  return "neutral"
}

function formatDistanceRange(range) {
  if (!range || range.min == null) return "—"
  const min = range.min
  const max = range.max
  return max == null ? `${min}+ ft` : `${min}–${max} ft`
}

/* ----------------- UI primitives ----------------- */

function Divider() {
  return <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
}

function Section({ title, subtitle, children }) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/35 p-3 ring-1 ring-white/5">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{title}</p>
      {children}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="group rounded-2xl border border-zinc-700/70 bg-gradient-to-b from-zinc-950/55 to-zinc-900/25 p-4 shadow-sm ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:border-zinc-600/80 hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white tracking-tight">{value ?? "—"}</p>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/30 p-3 ring-1 ring-white/5">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value ?? "—"}</p>
    </div>
  )
}

function Badge({ children, tone = "neutral" }) {
  const map = {
    left: "border-sky-400/40 bg-sky-400/10 text-sky-200 ring-sky-400/10",
    right: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200 ring-fuchsia-400/10",
    center: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200 ring-white/5",
    neutral: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200 ring-white/5",
  }
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm ring-1",
        map[tone] ?? map.neutral,
      ].join(" ")}
    >
      {children}
    </span>
  )
}

function FilterChip({ active, onClick, label, meta }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition focus:outline-none focus:ring-2 focus:ring-emerald-400/40",
        active
          ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-200 shadow-[0_8px_20px_rgba(16,185,129,0.12)]"
          : "border-zinc-700/70 bg-zinc-950/30 text-zinc-300 hover:bg-zinc-950/50 hover:border-zinc-600/80",
      ].join(" ")}
    >
      <span className="font-medium">{label}</span>
      {meta ? <span className="text-zinc-400">{meta}</span> : null}
    </button>
  )
}

function ConfidencePill({ value }) {
  const v = Number(value)
  const pct = isFinite(v) ? Math.max(0, Math.min(1, v)) : null
  const tone =
    pct == null ? "neutral" : pct >= 0.8 ? "good" : pct >= 0.55 ? "mid" : "low"

  const styles = {
    good: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200",
    mid: "border-amber-400/50 bg-amber-400/10 text-amber-200",
    low: "border-rose-400/50 bg-rose-400/10 text-rose-200",
    neutral: "border-zinc-600/60 bg-zinc-500/10 text-zinc-200",
  }

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs shadow-sm ring-1 ring-white/5",
        styles[tone],
      ].join(" ")}
    >
      <span className="text-[11px] uppercase tracking-wide opacity-80">conf</span>
      <span className="font-semibold text-white">
        {pct == null ? "—" : `${Math.round(pct * 100)}%`}
      </span>
    </span>
  )
}

function TinyPill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-950/25 px-2.5 py-1 text-[11px] text-zinc-300 ring-1 ring-white/5">
      <span className="uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="font-semibold text-zinc-200">{value ?? "—"}</span>
    </span>
  )
}

function Meter({ value, label }) {
  const v = Number(value)
  const pct = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0

  const barTone =
    pct >= 0.8
      ? "from-emerald-400 to-emerald-300"
      : pct >= 0.55
        ? "from-amber-400 to-amber-300"
        : "from-rose-400 to-rose-300"

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="text-zinc-200 font-semibold">{Math.round(pct * 100)}%</span>
      </div>
      <div className="mt-2 h-2.5 w-full rounded-full bg-zinc-800/80 overflow-hidden ring-1 ring-white/5">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barTone} transition-[width] duration-500`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

function DownloadButton({ filename, mime, content, href, label, variant = "secondary" }) {
  const onClick = () => {
    if (href) return
    const blob = new Blob([content ?? ""], { type: mime ?? "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename ?? "download"
    a.click()
    URL.revokeObjectURL(url)
  }

  const styles = {
    primary:
      "border-emerald-400/70 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25 shadow-[0_10px_26px_rgba(16,185,129,0.12)]",
    secondary:
      "border-zinc-700/70 bg-zinc-950/30 text-zinc-200 hover:bg-zinc-950/55",
  }

  const base =
    "inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ring-1 ring-white/5"

  return href ? (
    <a className={[base, styles[variant] ?? styles.secondary].join(" ")} href={href} download={filename}>
      {label}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={[base, styles[variant] ?? styles.secondary].join(" ")}>
      {label}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-zinc-700/70 bg-zinc-950/30 p-8 text-center ring-1 ring-white/5">
      <p className="text-sm font-semibold text-white">No speech detected</p>
      <p className="mt-1 text-sm text-zinc-400">Try a louder clip or a file with clearer speech.</p>
    </div>
  )
}

function EmptyStateCustom({ title, subtitle }) {
  return (
    <div className="rounded-3xl border border-zinc-700/70 bg-zinc-950/30 p-8 text-center ring-1 ring-white/5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
    </div>
  )
}

function Dot() {
  return <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
}

function fmtNum(v) {
  const n = Number(v)
  if (!isFinite(n)) return "—"
  return n.toFixed(4)
}

function fmtNum2(v) {
  const n = Number(v)
  if (!isFinite(n)) return "—"
  return n.toFixed(2)
}

function fmtPct(v) {
  const n = Number(v)
  if (!isFinite(n)) return "—"
  const pct = Math.max(0, Math.min(1, n)) * 100
  return `${pct.toFixed(0)}%`
}