// Whisper Web Worker for Speech-to-Text
let whisperModule = null
let isInitialized = false

// Mock Whisper implementation (replace with actual whisper.cpp WASM)
class MockWhisper {
  constructor() {
    this.isReady = false
  }

  async initialize() {
    // Simulate loading Whisper WASM
    await new Promise((resolve) => setTimeout(resolve, 1000))
    this.isReady = true
    console.log("Whisper initialized")
  }

  async transcribe(audioBlob, isRealTime = false) {
    if (!this.isReady) {
      throw new Error("Whisper not initialized")
    }

    // Simulate transcription processing time
    await new Promise((resolve) => setTimeout(resolve, isRealTime ? 50 : 200))

    // Mock transcription results
    const mockTranscripts = [
      "Hello, how are you today?",
      "What's the weather like?",
      "Can you help me with something?",
      "Tell me a joke please",
      "What time is it now?",
    ]

    return mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)]
  }
}

// Initialize Whisper when worker starts
const initializeWhisper = async () => {
  try {
    whisperModule = new MockWhisper()
    await whisperModule.initialize()
    isInitialized = true
    console.log("Whisper worker initialized")
  } catch (error) {
    console.error("Failed to initialize Whisper:", error)
  }
}

// Handle messages from main thread
self.onmessage = async (event) => {
  const { type, data } = event.data

  if (!isInitialized) {
    await initializeWhisper()
  }

  try {
    switch (type) {
      case "process-chunk":
        // Process real-time audio chunk
        const realtimeText = await whisperModule.transcribe(data, true)
        self.postMessage({
          type: "transcript",
          data: { text: realtimeText, isFinal: false },
        })
        break

      case "process-final":
        // Process final audio for complete transcription
        const finalText = await whisperModule.transcribe(data, false)
        self.postMessage({
          type: "transcript",
          data: { text: finalText, isFinal: true },
        })
        break

      default:
        console.warn("Unknown message type:", type)
    }
  } catch (error) {
    console.error("Whisper processing error:", error)
    self.postMessage({
      type: "error",
      data: { message: error.message },
    })
  }
}

// Start initialization
initializeWhisper()
