// TTS Web Worker for Text-to-Speech
let ttsEngine = null
let isInitialized = false

// Mock TTS implementation (replace with actual TTS engine like Coqui)
class MockTTS {
  constructor() {
    this.isReady = false
    this.sampleRate = 22050
  }

  async initialize() {
    // Simulate loading TTS model
    await new Promise((resolve) => setTimeout(resolve, 1500))
    this.isReady = true
    console.log("TTS engine initialized")
  }

  async synthesize(text) {
    if (!this.isReady) {
      throw new Error("TTS engine not initialized")
    }

    // Simulate TTS processing time based on text length
    const processingTime = Math.max(200, text.length * 10)
    await new Promise((resolve) => setTimeout(resolve, processingTime))

    // Generate mock audio buffer (sine wave)
    const duration = Math.max(1, text.length * 0.05) // ~50ms per character
    const sampleCount = Math.floor(duration * this.sampleRate)
    const audioBuffer = new ArrayBuffer(sampleCount * 4) // 32-bit float
    const audioData = new Float32Array(audioBuffer)

    // Generate a simple sine wave as mock speech
    const frequency = 200 + Math.random() * 100 // Vary frequency slightly
    for (let i = 0; i < sampleCount; i++) {
      const t = i / this.sampleRate
      audioData[i] = Math.sin(2 * Math.PI * frequency * t) * 0.3 * Math.exp(-t * 2)
    }

    return audioBuffer
  }
}

// Initialize TTS when worker starts
const initializeTTS = async () => {
  try {
    ttsEngine = new MockTTS()
    await ttsEngine.initialize()
    isInitialized = true
    console.log("TTS worker initialized")
  } catch (error) {
    console.error("Failed to initialize TTS:", error)
  }
}

// Handle messages from main thread
self.onmessage = async (event) => {
  const { type, data } = event.data

  if (!isInitialized) {
    await initializeTTS()
  }

  try {
    switch (type) {
      case "synthesize":
        const audioBuffer = await ttsEngine.synthesize(data.text)
        self.postMessage({
          type: "audio-ready",
          data: { audioBuffer },
        })
        break

      default:
        console.warn("Unknown message type:", type)
    }
  } catch (error) {
    console.error("TTS processing error:", error)
    self.postMessage({
      type: "error",
      data: { message: error.message },
    })
  }
}

// Start initialization
initializeTTS()
