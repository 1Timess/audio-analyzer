import axios from "axios"

export async function analyzeAudio(file, accessCode) {
  const res = await axios.post("/analyze", file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Analysis-Code": accessCode,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })

  return res.data
}