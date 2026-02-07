import axios from "axios"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"

export async function analyzeAudio(file, accessCode) {
  const form = new FormData()
  form.append("file", file)

  const res = await axios.post(`${API_BASE}/analyze`, form, {
    headers: {
      "X-Analysis-Code": accessCode,
    },
  })

  return res.data
}