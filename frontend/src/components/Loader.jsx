import { useEffect, useMemo, useRef, useState } from "react"

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/**
 * Human-friendly ETA label
 */
function formatEta(ms) {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `~${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `~${m}m`
  const h = Math.round(m / 60)
  return `~${h}h`
}

/**
 * Normalize input size to bytes.
 */
function normalizeBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return null

  if (size < 50_000_000 && size >= 1_000) {
    const looksLikeKb = size % 1024 === 0 || size > 10_000
    if (looksLikeKb) return size * 1024
  }

  return size
}

/**
 * Throughput model (MB/sec)
 * Default calibrated for heavy CPU inference (~1GB ≈ 1 hour)
 */
const DEFAULT_MB_PER_SEC = 0.28

function getObservedThroughput() {
  const stored = localStorage.getItem("analysis_mb_per_sec")
  const parsed = parseFloat(stored)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MB_PER_SEC
}

/**
 * Estimate total analysis time based on file size
 * using observed throughput instead of arbitrary curves.
 */
function estimateMsFromBytes(rawSize) {
  const bytes = normalizeBytes(rawSize)
  if (!bytes) return 2500

  const mb = bytes / (1024 * 1024)
  const mbPerSec = getObservedThroughput()

  const seconds = mb / mbPerSec

  // Baseline decode / warmup overhead
  const baseMs = 2000

  return clamp(seconds * 1000 + baseMs, 5000, 6 * 60 * 60 * 1000)
}

export default function Loader({ fileSizeBytes, done = false }) {
  const estMs = useMemo(
    () => estimateMsFromBytes(fileSizeBytes),
    [fileSizeBytes]
  )

  const etaLabel = useMemo(() => formatEta(estMs), [estMs])

  const [progress, setProgress] = useState(0)
  const startRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    startRef.current = performance.now()
    setProgress(0)

    const tick = (now) => {
      const elapsed = now - startRef.current
      const t = clamp(elapsed / estMs, 0, 1)

      // Slow early ramp for large jobs
      const isLargeJob = estMs > 5 * 60 * 1000
      const slowStartFactor = isLargeJob ? 0.4 : 0.6

      let eased

      if (t < slowStartFactor) {
        const tt = t / slowStartFactor
        eased = 0.6 * (1 - Math.pow(1 - tt, 2.5))
      } else {
        const tt = (t - slowStartFactor) / (1 - slowStartFactor)
        eased = 0.6 + 0.35 * (1 - Math.pow(1 - tt, 1.8))
      }

      const target = done ? 1 : 0.95
      setProgress(eased * target)

      if (!done && t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (!done && t >= 1) {
        setProgress(0.95)
      } else {
        setProgress(1)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [estMs, done])

  const prettySize = useMemo(() => {
    const bytes = normalizeBytes(fileSizeBytes)
    if (!bytes) return null

    const mb = bytes / (1024 * 1024)

    if (mb < 1) return `${Math.round(bytes / 1024)} KB`
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    return `${(mb / 1024).toFixed(2)} GB`
  }, [fileSizeBytes])

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-150 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-zinc-300">
          Analyzing audio…
          <span className="ml-2 text-zinc-500">
            ({prettySize ?? "file"} · {etaLabel})
          </span>
        </p>
        <p className="text-zinc-500">
          {Math.round(progress * 100)}%
        </p>
      </div>

      <p className="text-xs text-zinc-500">
        Estimate adapts over time based on real processing speed.
      </p>
    </div>
  )
}