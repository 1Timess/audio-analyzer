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
 * - Accepts bytes (number)
 * - If caller accidentally passes KB, we auto-correct in a safe way
 * - If invalid, returns null
 *
 * Heuristic:
 *   - Anything under ~50 million that *looks* like KB (e.g., 27000 for "27,000KB")
 *     is very likely KB, not bytes.
 */
function normalizeBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return null

  // If the number is "small" but would be a very common KB magnitude, treat as KB.
  // Example: 27000 (27,000 KB) is not a realistic byte count for audio uploads.
  if (size < 50_000_000 && size >= 1_000) {
    // If it's divisible-ish by 1024 or looks like rounded KB, assume KB.
    const looksLikeKb = size % 1024 === 0 || size > 10_000
    if (looksLikeKb) return size * 1024
  }

  return size
}

/**
 * Estimate analysis time from file size.
 *
 * Your real-world anchors (approx):
 * - ~100 KB: instant
 * - ~3 MB: up to ~20s
 * - ~10 MB: ~1–2m
 * - ~27 MB: ~1m+
 * - ~1 GB: ~1h
 *
 * Use a piecewise curve:
 * - small: quick linear-ish
 * - medium: steeper (superlinear)
 * - huge: very steep (to reflect memory/IO/segment explosion)
 */
function estimateMsFromBytes(rawSize) {
  const bytes = normalizeBytes(rawSize)
  if (!bytes) return 2500

  const mb = bytes / (1024 * 1024)

  // Baseline overhead (decode/setup)
  const baseMs = 1200

  let seconds

  if (mb <= 1) {
    // Tiny files: basically instant, but never 0
    // 0–1MB => ~1–4s
    seconds = 1 + 3 * mb
  } else if (mb <= 30) {
    // Medium: matches your 3MB->~20s, 10MB->~1-2m, 27MB->~1m+
    // Power curve tuned for mid-range
    const p = 1.35
    const a = 5.2 // coefficient in seconds
    seconds = a * Math.pow(mb, p)
  } else {
    // Large: escalates harder, aiming for ~1GB ~ 1 hour
    // Use a higher exponent above 30MB to reflect heavy scaling costs
    const p = 1.55
    const a = 1.9
    seconds = a * Math.pow(mb, p)
  }

  const ms = seconds * 1000 + baseMs

  // Floors/caps for UX sanity
  // - Don’t claim sub-5s unless truly tiny (< ~300KB)
  const minMs = mb < 0.3 ? 300 : 5_000

  return clamp(ms, minMs, 6 * 60 * 60 * 1000) // up to 6h
}

export default function Loader({ fileSizeBytes, done = false }) {
  const estMs = useMemo(() => estimateMsFromBytes(fileSizeBytes), [fileSizeBytes])
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

      // Two-phase easing:
      // - Fast to ~70%
      // - Slow creep to ~95%
      let eased
      if (t < 0.6) {
        const tt = t / 0.6
        eased = 0.7 * (1 - Math.pow(1 - tt, 3))
      } else {
        const tt = (t - 0.6) / 0.4
        eased = 0.7 + 0.25 * (1 - Math.pow(1 - tt, 2))
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
        <p className="text-zinc-500">{Math.round(progress * 100)}%</p>
      </div>

      <p className="text-xs text-zinc-500">
        Estimate based on file size — actual time varies with device performance and audio content.
      </p>
    </div>
  )
}