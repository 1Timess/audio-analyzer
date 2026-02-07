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
  const [accessCode, setAccessCode] = useState("") // ✅ store code

  const handleFile = async (file) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await analyzeAudio(file, accessCode) // ✅ send code
      setResult(data)
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || "Audio analysis failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="w-full px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white">Audio Analyzer</h1>
          <p className="mt-2 text-zinc-400">
            Upload audio to detect speech segments and preview snippets.
          </p>
        </header>

        <div className="grid gap-8 grid-cols-[420px_minmax(0,1fr)] items-start">
          <div className="space-y-6">
            <UploadCard
              onFile={handleFile}
              onCode={setAccessCode} // ✅ receive code from UploadCard
              disabled={loading}
            />

            {loading && <Loader />}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="space-y-6 sticky top-8 self-start"></div>
            <Key />
          </div>

          <div>
            {result ? (
              <AnalysisResult result={result} />
            ) : (
              <div className="rounded-2xl border border-zinc-700 bg-zinc-800/40 p-8 text-zinc-400">
                Upload an audio file to see analysis results here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}