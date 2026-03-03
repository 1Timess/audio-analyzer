import axios from "axios"

export async function analyzeAudio(file, accessCode) {
  const form = new FormData()
  form.append("file", file)

  const res = await axios.post("/analyze", form, {
    headers: { "X-Analysis-Code": accessCode },
  })

  return res.data
}