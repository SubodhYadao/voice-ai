export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return Response.json({ error: "No audio file provided" }, { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: "Groq API key not configured" }, { status: 500 })
    }

    console.log("Received audio file:", {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    })

    // Validate file size (Groq has a 25MB limit)
    if (audioFile.size > 25 * 1024 * 1024) {
      return Response.json({ error: "Audio file too large (max 25MB)" }, { status: 400 })
    }

    // Validate file size (minimum check)
    if (audioFile.size < 100) {
      return Response.json({ error: "Audio file too small or empty" }, { status: 400 })
    }

    // Create form data for Groq API
    const groqFormData = new FormData()

    // Convert the file to a proper format if needed
    let processedFile = audioFile

    // If the file type is not supported, try to create a new blob with a supported type
    if (!audioFile.type || audioFile.type === "audio/webm") {
      const arrayBuffer = await audioFile.arrayBuffer()
      processedFile = new File([arrayBuffer], "recording.wav", { type: "audio/wav" })
    }

    groqFormData.append("file", processedFile)
    groqFormData.append("model", "whisper-large-v3")
    groqFormData.append("response_format", "json")
    groqFormData.append("language", "en")
    groqFormData.append("temperature", "0")

    console.log("Sending to Groq API...")

    // Send to Groq API
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqFormData,
    })

    console.log("Groq API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Groq API error:", response.status, errorText)

      let errorMessage = "Transcription failed"
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorData.message || errorMessage
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 100)}`
      }

      return Response.json(
        {
          error: errorMessage,
          details: `HTTP ${response.status}`,
          success: false,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("Groq API response:", data)

    return Response.json({
      text: data.text || "",
      success: true,
    })
  } catch (error: any) {
    console.error("Transcription error:", error)

    // Handle specific errors
    if (error.code === "ENOTFOUND") {
      return Response.json(
        {
          error: "Network error - could not reach Groq API",
          details: error.message,
          success: false,
        },
        { status: 503 },
      )
    }

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return Response.json(
        {
          error: "Network error - failed to connect to Groq API",
          details: error.message,
          success: false,
        },
        { status: 503 },
      )
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

    return Response.json(
      {
        error: "Failed to process transcription",
        details: errorMessage,
        success: false,
      },
      { status: 500 },
    )
  }
}
