import axios from "axios"

export async function analyzeAudio(file, accessCode) {
  const form = new FormData()
  form.append("file", file)

  console.log("Sending access code:", accessCode)

  const res = await axios({
    method: "post",
    url: "/analyze",
    data: form,
    headers: {
      "X-Analysis-Code": accessCode,
    },
  })

  return res.data
}