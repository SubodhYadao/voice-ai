# Voice AI Assistant (Groq-Powered)

A Next.js application that provides real-time voice interaction using Groq's fast AI APIs for speech-to-text and chat completion, with local text-to-speech synthesis.

## Features

- 🎤 **Real Speech-to-Text**: Uses Groq's Whisper API for fast, accurate transcription
- 🤖 **Groq Chat Integration**: Powered by Llama 3.1 70B for intelligent responses
- 🔊 **Local Text-to-Speech**: Synthesizes AI responses locally using cached TTS
- 📱 **PWA Support**: Installable as a Progressive Web App
- ⚡ **Performance Monitoring**: Real-time latency tracking with < 1.2s target
- 🔄 **Offline UI**: Works offline for cached content, requires internet for AI features

## Architecture

\`\`\`
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Main Thread   │    │   Groq APIs      │    │  Service Worker │
│                 │    │                  │    │                 │
│ • UI Components │    │ • Whisper STT    │    │ • Asset Caching │
│ • Audio Recording│◄──►│ • Llama Chat     │    │ • Offline Mode  │
│ • Local TTS     │    │ • Fast Inference │    │ • Cache Strategy│
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
\`\`\`

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Groq API key (free tier available)

### Environment Variables

Create a `.env.local` file in the root directory:

\`\`\`env
GROQ_API_KEY=your_groq_api_key_here
\`\`\`

Get your free Groq API key at: https://console.groq.com/keys

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd offline-voice-ai
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
# or
pnpm install
\`\`\`

3. Run the development server:
\`\`\`bash
npm run dev
# or
pnpm dev
\`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Build

\`\`\`bash
npm run build
npm start
\`\`\`

## Usage

1. **Setup**: Add your Groq API key to `.env.local`
2. **Recording**: Click the microphone button to start recording
3. **Processing**: Speech is transcribed using Groq's Whisper API
4. **Chat**: Transcription is sent to Groq's Llama model for response
5. **Playback**: AI response is synthesized locally and played back

## API Endpoints

### `/api/transcribe`
- **Method**: POST
- **Body**: FormData with audio file
- **Response**: Transcribed text using Groq Whisper

### `/api/chat`
- **Method**: POST  
- **Body**: JSON with text
- **Response**: AI response using Groq Llama 3.1

## Performance Targets

- **STT Latency**: < 500ms (Groq Whisper is very fast)
- **Chat Latency**: < 300ms (Groq inference is optimized for speed)
- **TTS Latency**: < 400ms (local synthesis)
- **Total Response Time**: < 1.2s

## Groq API Benefits

- **Fast Inference**: Groq's hardware is optimized for speed
- **Free Tier**: Generous free usage limits
- **High Quality**: Whisper-large-v3 and Llama 3.1 70B models
- **Reliable**: Enterprise-grade API infrastructure

## File Structure

\`\`\`
├── app/
│   ├── api/
│   │   ├── transcribe/route.ts   # Groq Whisper API
│   │   └── chat/route.ts         # Groq Chat API
│   ├── layout.tsx                # Root layout with PWA meta
│   ├── page.tsx                  # Main voice interface
│   └── globals.css               # Global styles
├── public/
│   ├── sw.js                     # Service Worker
│   ├── manifest.json             # PWA manifest
│   └── workers/
│       └── tts-worker.js         # TTS Web Worker
└── components/ui/                # shadcn/ui components
\`\`\`

## Browser Compatibility

- Chrome 88+
- Firefox 84+
- Safari 14+
- Edge 88+

Requires:
- MediaRecorder API
- Web Audio API
- Fetch API with FormData

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
