import { useState } from "react"
import UploadCard from "./components/UploadCard"
import AnalysisResult from "./components/AnalysisResult"
import Loader from "./components/Loader"
import Key from "./components/Key"
import { analyzeAudio } from "./api/audio"

export default function App() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [accessCode, setAccessCode] = useState("")   // ✅ add

  const handleFile = async (file) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await analyzeAudio(file, accessCode)  // ✅ pass it
      setResult(data)
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || "Audio analysis failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-b from-zinc-950 via-zinc-950 to-black" />
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-size-[48px_48px]" />
      </div>

      <div className="mx-auto w-full max-w-368 px-6 py-8 lg:px-10 lg:py-10">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950/30 px-3 py-1 text-xs text-zinc-200 ring-1 ring-white/5">
              <span className="h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
              Analyzer Dashboard
            </p>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Audio Analyzer
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400 md:text-base">
              Upload audio to detect speech segments, preview clips, and review spatial + speaker heuristics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {loading ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950/30 px-3 py-1 text-xs text-zinc-200 ring-1 ring-white/5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400/80" />
                Processing…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950/30 px-3 py-1 text-xs text-zinc-200 ring-1 ring-white/5">
                <span className="h-2 w-2 rounded-full bg-zinc-400/70" />
                Ready
              </span>
            )}
          </div>
        </header>

        {/* Main layout */}
        <div className="grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Left column */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-zinc-700/60 bg-linear-to-b from-zinc-900/60 to-zinc-950/40 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.35)] ring-1 ring-white/5">
              <UploadCard
                onFile={handleFile}
                onCode={setAccessCode}     // ✅ capture code
                disabled={loading}
              />
            </div>

            {loading && (
              <div className="rounded-3xl border border-zinc-700/60 bg-zinc-950/30 p-4 ring-1 ring-white/5">
                <Loader />
              </div>
            )}

            {error && (
              <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-sm ring-1 ring-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-rose-100">Analysis failed</p>
                    <p className="mt-1 text-rose-200/90">{error}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-100">
                    Error
                  </span>
                </div>
              </div>
            )}

            <div className="sticky top-8">
              <Key />
            </div>
          </aside>

          {/* Right column */}
          <main>
            {result ? (
              <AnalysisResult result={result} />
            ) : (
              <div className="rounded-3xl border border-zinc-700/60 bg-linear-to-b from-zinc-900/55 to-zinc-950/35 p-10 text-center shadow-[0_8px_30px_rgb(0,0,0,0.30)] ring-1 ring-white/5">
                <div className="mx-auto max-w-md">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700/60 bg-zinc-950/30 ring-1 ring-white/5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">No analysis yet</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Upload an audio or video file to generate segments and preview snippets here.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950/25 px-3 py-1 text-xs text-zinc-300 ring-1 ring-white/5">
                    <span className="text-zinc-400">Tip:</span> Use a clear voice clip for best results.
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <footer className="mt-10 flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p>Audio Analyzer • EV</p>
          <p className="text-zinc-600">
            Metrics are heuristic — treat low-confidence labels as best-effort.
          </p>
        </footer>
      </div>
    </div>
  )
}