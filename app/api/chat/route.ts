export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text || !text.trim()) {
      return Response.json({ error: "No text provided" }, { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: "Groq API key not configured" }, { status: 500 })
    }

    // Send to Groq Chat API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant. Keep responses concise and conversational, suitable for voice interaction. Limit responses to 2-3 sentences.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Groq Chat API error:", response.status, errorData)
      return Response.json(
        {
          error: "Chat completion failed",
          details: `HTTP ${response.status}`,
          success: false,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    const responseMessage = data.choices?.[0]?.message?.content || "Sorry, I could not generate a response."

    return Response.json({
      message: responseMessage,
      success: true,
    })
  } catch (error: any) {
    console.error("Chat API error:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

    return Response.json(
      {
        error: "Failed to process chat request",
        details: errorMessage,
        success: false,
      },
      { status: 500 },
    )
  }
}
