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
    <div className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-800/70 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Analysis</h2>
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
          />
        </div>
      </div>

      {/* Overview */}
      <Section title="Overview">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Duration" value={duration != null ? `${duration.toFixed(2)}s` : "—"} />
          <Stat label="Sample Rate" value={result?.sample_rate ? `${result.sample_rate} Hz` : "—"} />
          <Stat label="Channels" value={result?.channels ?? "—"} />
          <Stat label="Segments" value={segmentsRaw.length} />
          <Stat label="Speakers" value={speakersCount || "—"} />
        </div>

        {rhythm && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3">
            <div className="text-sm text-zinc-300">
              <span className="text-zinc-400">Rhythm estimate:</span>{" "}
              <span className="font-medium text-white">{rhythm}</span>
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
                      className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4"
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
                        <MiniStat
                          label="Pitch bucket"
                          value={sp.pitch_bucket ?? "unknown"}
                        />
                        <MiniStat
                          label="Median pitch"
                          value={
                            sp.median_pitch_hz != null
                              ? `${Number(sp.median_pitch_hz).toFixed(1)} Hz`
                              : "—"
                          }
                        />
                        <MiniStat
                          label="Tempo bucket"
                          value={sp.tempo_bucket ?? "unknown"}
                        />
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

                      {sp.note && (
                        <p className="mt-3 text-xs text-zinc-500">{sp.note}</p>
                      )}
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
          <div className="grid gap-6 grid-cols-[360px_1fr]">
            {/* Segment list */}
            <div className="space-y-2">
              <div className="max-h-140 overflow-y-auto pr-1">
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

                  return (
                    <button
                      key={i}
                      onClick={() => setActiveIdx(i)}
                      className={[
                        "w-full text-left rounded-xl border px-4 py-3 transition",
                        i === activeIdx
                          ? "border-emerald-400 bg-emerald-400/10"
                          : "border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-zinc-600",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">
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
                          <ConfidencePill value={conf} />
                          <TinyPill label="dir" value={fmtPct(seg?.direction_confidence)} />
                          <TinyPill label="dist" value={fmtPct(distanceConf)} />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Segment detail */}
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4">
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
                  />
                ) : (
                  <Badge tone="neutral">No clip</Badge>
                )}
              </div>

              <div className="mt-4 space-y-4">
                {/* Playback */}
                <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Playback</p>
                  {active?.clip_base64 ? (
                    <audio className="mt-2 w-full" controls src={active.clip_base64} />
                  ) : (
                    <p className="mt-2 text-sm text-zinc-400">No audio clip attached for this segment.</p>
                  )}
                </div>

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
                <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-3 space-y-3">
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
                    <p className="text-xs text-zinc-500">
                      {active.spatial_note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Advanced */}
      <Section title="Advanced">
        <details className="group rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
          <summary className="cursor-pointer select-none text-sm text-zinc-300 hover:text-white">
            Raw backend output
            <span className="ml-2 text-xs text-zinc-500 group-open:hidden">click to expand</span>
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-black/40 p-4 text-xs text-zinc-300">
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

function Section({ title, subtitle, children }) {
  return (
    <div className="mt-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value ?? "—"}</p>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value ?? "—"}</p>
    </div>
  )
}

function Badge({ children, tone = "neutral" }) {
  const map = {
    left: "border-sky-400/40 bg-sky-400/10 text-sky-200",
    right: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200",
    center: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
    neutral: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${map[tone] ?? map.neutral}`}>
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
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
          : "border-zinc-700 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900/60 hover:border-zinc-600",
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
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-300">
      <span className="text-zinc-400">conf</span>
      <span className="font-semibold text-white">{pct == null ? "—" : `${Math.round(pct * 100)}%`}</span>
    </span>
  )
}

function TinyPill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-zinc-400">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="font-semibold text-zinc-200">{value ?? "—"}</span>
    </span>
  )
}

function Meter({ value, label }) {
  const v = Number(value)
  const pct = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="text-zinc-300 font-medium">{Math.round(pct * 100)}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

function DownloadButton({ filename, mime, content, href, label }) {
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

  return href ? (
    <a
      className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 transition"
      href={href}
      download={filename}
    >
      {label}
    </a>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 transition"
    >
      {label}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-6 text-center">
      <p className="text-sm font-semibold text-white">No speech detected</p>
      <p className="mt-1 text-sm text-zinc-400">
        Try a louder clip or a file with clearer speech.
      </p>
    </div>
  )
}

function EmptyStateCustom({ title, subtitle }) {
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-6 text-center">
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
