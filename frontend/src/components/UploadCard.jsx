import { useMemo, useRef, useState } from "react"

export default function UploadCard({ onFile, onCode }) {
  const inputRef = useRef(null)

  const [isOpen, setIsOpen] = useState(false)
  const [code, setCode] = useState("")
  const [unlocked, setUnlocked] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const isValidFormat = useMemo(() => /^\d{5}$/.test(code), [code])

  const openPicker = () => inputRef.current?.click()

  const handleFile = (file) => {
    if (!file) return
    onFile?.(file)
  }

  const handleCardClick = () => {
    if (unlocked) return openPicker()
    setIsOpen(true)
  }

  const submit = () => {
    if (!isValidFormat) return

    setUnlocked(true)
    setIsOpen(false)
    onCode?.(code)

    setTimeout(openPicker, 50)
  }

  const lock = () => {
    setUnlocked(false)
    setCode("")
    onCode?.("")
  }

  // ---------------- Drag & Drop ----------------

const onDragEnter = (e) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragging(true)
}

const onDragOver = (e) => {
  e.preventDefault()
  e.stopPropagation()
  e.dataTransfer.dropEffect = unlocked ? "copy" : "none"
  setIsDragging(true)
}

const onDragLeave = (e) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragging(false)
}

const onDrop = (e) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragging(false)

  const dt = e.dataTransfer

  if (!dt) return

  // Prefer items API (more reliable on Windows)
  if (dt.items && dt.items.length > 0) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i]
      if (item.kind === "file") {
        const file = item.getAsFile()
        if (file) {
          if (!unlocked) {
            setIsOpen(true)
            return
          }
          handleFile(file)
          return
        }
      }
    }
  }

  // Fallback
  const file = dt.files?.[0]
  if (file) {
    if (!unlocked) {
      setIsOpen(true)
      return
    }
    handleFile(file)
  }
}

  return (
    <>
      <div
        data-dropzone
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          "cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition",
          "focus:outline-none focus:ring-2 focus:ring-emerald-400",
          unlocked
            ? "border-zinc-700 bg-zinc-800/40 hover:border-emerald-400 hover:bg-zinc-800"
            : "border-zinc-800 bg-zinc-900/40",
          isDragging && unlocked
            ? "border-emerald-400 bg-emerald-400/10"
            : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*,.mp4,.mov,.m4a,.aac,.wav,.mp3,.flac,.ogg,.webm"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-300">
          <span className="text-zinc-400">Access</span>
          <span className={unlocked ? "text-emerald-300" : "text-zinc-200"}>
            {unlocked ? "Unlocked" : "Locked"}
          </span>

          {unlocked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                lock()
              }}
              className="ml-2 rounded-full border border-zinc-700 bg-zinc-950/40 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-950/70"
            >
              Lock
            </button>
          )}
        </div>

        <p className="mt-4 text-lg font-semibold text-white">
          Upload audio or video
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          MP3, WAV, M4A, MP4, MOV — click or drop
        </p>

        {!unlocked && (
          <p className="mt-4 text-xs text-zinc-500">
            Requires a 5-digit access code to analyze.
          </p>
        )}

        {isDragging && unlocked && (
          <p className="mt-4 text-sm font-medium text-emerald-300">
            Drop file to analyze
          </p>
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false)
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/90 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Enter access code</p>
                <p className="mt-1 text-sm text-zinc-400">
                  You’ll need a 5-digit code to run analysis.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-950/40 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-950/70"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-wide text-zinc-500">
                Code
              </label>

              <input
                autoFocus
                inputMode="numeric"
                pattern="\d*"
                maxLength={5}
                value={code}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 5)
                  setCode(next)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit()
                  if (e.key === "Escape") setIsOpen(false)
                }}
                placeholder="#####"
                className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none
                           placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              />

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  {isValidFormat ? "Format looks good." : "Enter exactly 5 digits."}
                </p>

                <button
                  type="button"
                  onClick={submit}
                  disabled={!isValidFormat}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    !isValidFormat
                      ? "cursor-not-allowed border border-zinc-700 bg-zinc-800/40 text-zinc-400"
                      : "border border-emerald-400 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25",
                  ].join(" ")}
                >
                  Continue
                </button>
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                The server will validate the code when you analyze.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
