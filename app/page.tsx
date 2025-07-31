"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, MicOff, Volume2, Loader2, Info } from "lucide-react"

interface PerformanceMetrics {
  sttLatency: number
  apiLatency: number
  ttsLatency: number
  totalLatency: number
}

export default function VoiceAI() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [response, setResponse] = useState("")
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [cacheStatus, setCacheStatus] = useState("Checking cache...")
  const [connectionStatus, setConnectionStatus] = useState("Ready")
  const [lastError, setLastError] = useState<string | null>(null)
  const [serviceWorkerSupported, setServiceWorkerSupported] = useState(true)
  const [stylesLoaded, setStylesLoaded] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const ttsWorkerRef = useRef<Worker | null>(null)
  const startTimeRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  // Check if we're in a secure context
  const isSecureContext =
    typeof window !== "undefined" && (window.isSecureContext || window.location.hostname === "localhost")

  // Check if styles are loaded
  useEffect(() => {
    const checkStyles = () => {
      const testElement = document.createElement("div")
      testElement.className = "bg-blue-500"
      document.body.appendChild(testElement)
      const styles = window.getComputedStyle(testElement)
      const hasStyles = styles.backgroundColor === "rgb(59, 130, 246)" || styles.backgroundColor === "#3b82f6"
      document.body.removeChild(testElement)
      setStylesLoaded(hasStyles)
    }

    // Check immediately and after a short delay
    checkStyles()
    const timer = setTimeout(checkStyles, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Initialize workers and check cache status
  useEffect(() => {
    const initializeApp = async () => {
      // Check if service worker is supported and we're in a secure context
      if ("serviceWorker" in navigator && isSecureContext) {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js")
          console.log("Service Worker registered:", registration)
          setServiceWorkerSupported(true)

          // Check cache status
          try {
            const cache = await caches.open("voice-ai-v1")
            const cachedFiles = await cache.keys()
            setCacheStatus(`Cached ${cachedFiles.length} files`)
          } catch (cacheError) {
            console.warn("Cache check failed:", cacheError)
            setCacheStatus("Cache check failed")
          }
        } catch (error) {
          console.warn("Service Worker registration failed:", error)
          setServiceWorkerSupported(false)
          if (error instanceof Error && error.message.includes("insecure")) {
            setCacheStatus("Service Worker unavailable (requires HTTPS or localhost)")
          } else {
            setCacheStatus("Service Worker registration failed")
          }
        }
      } else {
        setServiceWorkerSupported(false)
        if (!isSecureContext) {
          setCacheStatus("Service Worker unavailable (requires HTTPS or localhost)")
        } else {
          setCacheStatus("Service Worker not supported")
        }
      }

      // Initialize TTS worker
      try {
        ttsWorkerRef.current = new Worker("/workers/tts-worker.js")
        ttsWorkerRef.current.onmessage = (event) => {
          const { type, data } = event.data
          if (type === "audio-ready") {
            playAudio(data.audioBuffer)
          }
        }
        ttsWorkerRef.current.onerror = (error) => {
          console.error("TTS worker error:", error)
        }
      } catch (error) {
        console.error("Failed to initialize TTS worker:", error)
      }

      // Check online status
      setIsOffline(!navigator.onLine)
      window.addEventListener("online", () => setIsOffline(false))
      window.addEventListener("offline", () => setIsOffline(true))
    }

    initializeApp()

    return () => {
      ttsWorkerRef.current?.terminate()
      // Clean up any active streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isSecureContext])

  const startRecording = async () => {
    try {
      // Clear previous data
      audioChunksRef.current = []
      setLastError(null)
      setTranscript("")
      setResponse("")
      setMetrics(null)

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      streamRef.current = stream

      // Check for supported MIME types
      let mimeType = "audio/webm;codecs=opus"
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm"
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/mp4"
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "" // Let browser choose
          }
        }
      }

      const options = mimeType ? { mimeType } : {}
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      console.log("Using MIME type:", mediaRecorder.mimeType)

      mediaRecorder.ondataavailable = (event) => {
        console.log("Data available:", event.data.size, "bytes")
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, chunks:", audioChunksRef.current.length)

        if (audioChunksRef.current.length === 0) {
          setLastError("No audio data recorded")
          setIsProcessing(false)
          return
        }

        // Create audio blob from all chunks
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        })

        console.log("Created audio blob:", audioBlob.size, "bytes, type:", audioBlob.type)

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }

        // Process the audio
        await handleAudioProcessing(audioBlob)
      }

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event)
        setLastError("Recording error occurred")
        setIsProcessing(false)
      }

      // Start recording
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      startTimeRef.current = Date.now()

      console.log("Recording started")
    } catch (error) {
      console.error("Error starting recording:", error)
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setLastError("Microphone access denied. Please allow microphone permissions and try again.")
        } else if (error.name === "NotFoundError") {
          setLastError("No microphone found. Please connect a microphone and try again.")
        } else {
          setLastError(`Failed to access microphone: ${error.message}`)
        }
      } else {
        setLastError("Failed to access microphone. Please check permissions.")
      }
    }
  }

  const stopRecording = () => {
    console.log("Stop recording requested")
    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop()
        setIsRecording(false)
        setIsProcessing(true)
        console.log("MediaRecorder stopped")
      }
    }
  }

  const handleAudioProcessing = async (audioBlob: Blob) => {
    console.log("Processing audio blob:", audioBlob.size, "bytes")

    if (audioBlob.size === 0) {
      setLastError("Empty audio recording")
      setIsProcessing(false)
      return
    }

    const sttStartTime = Date.now()

    try {
      // Convert to a format that Groq can handle better
      let processedBlob = audioBlob

      // If it's webm, try to convert to a more compatible format
      if (audioBlob.type.includes("webm")) {
        try {
          // Create a new blob with a more generic audio type
          processedBlob = new Blob([audioBlob], { type: "audio/wav" })
        } catch (e) {
          console.warn("Could not convert audio format, using original")
        }
      }

      // Create form data
      const formData = new FormData()
      formData.append("audio", processedBlob, "recording.wav")

      console.log("Sending to transcription API...")

      // Send to Groq transcription API
      const transcribeResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      })

      const transcribeData = await transcribeResponse.json()
      const sttEndTime = Date.now()
      const sttLatency = sttEndTime - sttStartTime

      console.log("Transcription response:", transcribeData)

      if (!transcribeResponse.ok || !transcribeData.success) {
        throw new Error(transcribeData.error || `Transcription failed: ${transcribeResponse.status}`)
      }

      const transcribedText = transcribeData.text?.trim()
      setTranscript(transcribedText || "No speech detected")

      if (!transcribedText) {
        setResponse("No speech detected. Please try speaking more clearly.")
        setMetrics({
          sttLatency,
          apiLatency: 0,
          ttsLatency: 0,
          totalLatency: sttLatency,
        })
        return
      }

      console.log("Transcribed text:", transcribedText)

      // Send to chat API
      const chatStartTime = Date.now()
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcribedText }),
      })

      const chatData = await chatResponse.json()
      const chatEndTime = Date.now()
      const apiLatency = chatEndTime - chatStartTime

      console.log("Chat response:", chatData)

      if (!chatResponse.ok || !chatData.success) {
        throw new Error(chatData.error || `Chat completion failed: ${chatResponse.status}`)
      }

      setResponse(chatData.message)
      setConnectionStatus("Connected")

      // Send to TTS worker
      const ttsStartTime = Date.now()
      ttsWorkerRef.current?.postMessage({
        type: "synthesize",
        data: { text: chatData.message, startTime: ttsStartTime },
      })

      // Update metrics
      setMetrics({
        sttLatency,
        apiLatency,
        ttsLatency: 0, // Will be updated when TTS completes
        totalLatency: 0,
      })
    } catch (error) {
      console.error("Error processing audio:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      setResponse(`Error: ${errorMessage}`)
      setLastError(errorMessage)

      // Still update metrics to show partial performance
      setMetrics({
        sttLatency: Date.now() - sttStartTime,
        apiLatency: 0,
        ttsLatency: 0,
        totalLatency: Date.now() - startTimeRef.current,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const playAudio = (audioBuffer: ArrayBuffer) => {
    const audioContext = new AudioContext()
    audioContext.decodeAudioData(audioBuffer).then((decodedData) => {
      const source = audioContext.createBufferSource()
      source.buffer = decodedData
      source.connect(audioContext.destination)
      source.start()

      const totalLatency = Date.now() - startTimeRef.current
      setMetrics((prev) =>
        prev
          ? {
              ...prev,
              ttsLatency: Date.now() - (prev.sttLatency + prev.apiLatency + startTimeRef.current),
              totalLatency,
            }
          : null,
      )
    })
  }

  // Fallback render if styles haven't loaded
  if (!stylesLoaded) {
    return (
      <div className="fallback-container">
        <div className="fallback-card">
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
            Voice AI Assistant (Groq-Powered)
          </h1>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", fontSize: "0.875rem" }}>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: isOffline ? "#ef4444" : "#10b981",
                  marginRight: "0.5rem",
                }}
              />
              {isOffline ? "Offline" : "Online"}
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor:
                    connectionStatus === "Connected" ? "#10b981" : connectionStatus === "Ready" ? "#3b82f6" : "#f59e0b",
                  marginRight: "0.5rem",
                }}
              />
              {connectionStatus}
            </span>
          </div>
          <div style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#6b7280" }}>{cacheStatus}</div>

          {!serviceWorkerSupported && !isSecureContext && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#dbeafe",
                border: "1px solid #93c5fd",
                borderRadius: "0.375rem",
                marginBottom: "1rem",
                fontSize: "0.875rem",
                color: "#1d4ed8",
              }}
            >
              <div style={{ fontWeight: "500" }}>Limited Offline Support</div>
              <div style={{ fontSize: "0.75rem" }}>
                For full offline capabilities, serve this app over HTTPS or access via localhost.
              </div>
            </div>
          )}

          {lastError && (
            <div
              style={{
                padding: "0.5rem",
                backgroundColor: "#fef2f2",
                borderRadius: "0.375rem",
                marginBottom: "1rem",
                fontSize: "0.875rem",
                color: "#dc2626",
              }}
            >
              Error: {lastError}
            </div>
          )}

          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`fallback-button ${isRecording ? "recording" : ""}`}
              style={{
                background: isProcessing ? "#9ca3af" : isRecording ? "#ef4444" : "#3b82f6",
                cursor: isProcessing ? "not-allowed" : "pointer",
              }}
            >
              {isProcessing ? "⏳" : isRecording ? "🎤" : "🎤"}
            </button>
          </div>

          <div style={{ textAlign: "center", fontSize: "0.875rem", color: "#6b7280" }}>
            {isProcessing
              ? "Processing audio..."
              : isRecording
                ? "Recording... Click to stop"
                : "Click to start recording"}
          </div>
        </div>

        {transcript && (
          <div className="fallback-card">
            <h3 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "0.5rem" }}>
              🎤 Transcript (Groq Whisper)
            </h3>
            <p style={{ color: "#374151" }}>{transcript}</p>
          </div>
        )}

        {response && (
          <div className="fallback-card">
            <h3 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "0.5rem" }}>
              🔊 AI Response (Groq Llama)
            </h3>
            <p style={{ color: "#374151" }}>{response}</p>
          </div>
        )}

        {metrics && (
          <div className="fallback-card">
            <h3 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "1rem" }}>Performance Metrics</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#3b82f6" }}>{metrics.sttLatency}ms</div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>STT Latency</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10b981" }}>{metrics.apiLatency}ms</div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>Chat Latency</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#8b5cf6" }}>{metrics.ttsLatency}ms</div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>TTS Latency</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: metrics.totalLatency < 1200 ? "#10b981" : "#ef4444",
                  }}
                >
                  {metrics.totalLatency}ms
                </div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>Total Latency</div>
              </div>
            </div>
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: metrics.totalLatency < 1200 ? "#10b981" : "#ef4444",
                }}
              >
                Target: &lt; 1200ms {metrics.totalLatency < 1200 ? "✓" : "✗"}
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: "0.75rem", color: "#9ca3af", marginTop: "2rem" }}>
          Loading styled interface... If this persists, the fallback interface above is fully functional.
        </div>
      </div>
    )
  }

  // Normal styled render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Voice AI Assistant (Groq-Powered)</span>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isOffline ? "bg-red-500" : "bg-green-500"}`} />
                  <span>{isOffline ? "Offline" : "Online"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      connectionStatus === "Connected"
                        ? "bg-green-500"
                        : connectionStatus === "Ready"
                          ? "bg-blue-500"
                          : "bg-yellow-500"
                    }`}
                  />
                  <span>{connectionStatus}</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">{cacheStatus}</div>

            {!serviceWorkerSupported && !isSecureContext && (
              <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 p-3 rounded border border-blue-200">
                <Info className="w-4 h-4" />
                <div>
                  <div className="font-medium">Limited Offline Support</div>
                  <div className="text-xs">
                    For full offline capabilities, serve this app over HTTPS or access via localhost. Currently using
                    Groq API for real-time transcription.
                  </div>
                </div>
              </div>
            )}

            {lastError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">Error: {lastError}</div>}

            <div className="flex justify-center">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                size="lg"
                className={`w-32 h-32 rounded-full ${
                  isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
            </div>

            <div className="text-center text-sm text-gray-600">
              {isProcessing
                ? "Processing audio..."
                : isRecording
                  ? "Recording... Click to stop"
                  : "Click to start recording"}
            </div>
          </CardContent>
        </Card>

        {transcript && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mic className="w-5 h-5" />
                <span>Transcript (Groq Whisper)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{transcript}</p>
            </CardContent>
          </Card>
        )}

        {response && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5" />
                <span>AI Response (Groq Llama)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{response}</p>
            </CardContent>
          </Card>
        )}

        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{metrics.sttLatency}ms</div>
                  <div className="text-sm text-gray-600">STT Latency</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{metrics.apiLatency}ms</div>
                  <div className="text-sm text-gray-600">Chat Latency</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{metrics.ttsLatency}ms</div>
                  <div className="text-sm text-gray-600">TTS Latency</div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${metrics.totalLatency < 1200 ? "text-green-600" : "text-red-600"}`}
                  >
                    {metrics.totalLatency}ms
                  </div>
                  <div className="text-sm text-gray-600">Total Latency</div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <div className={`text-sm ${metrics.totalLatency < 1200 ? "text-green-600" : "text-red-600"}`}>
                  Target: {"<"} 1200ms {metrics.totalLatency < 1200 ? "✓" : "✗"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
