# 🎙️ O Voice AI Assistant

A fully  voice assistant powered by local machine learning models for speech-to-text (STT) and text-to-speech (TTS). This app lets users record audio, transcribe speech using local Whisper models (no API required), and generate spoken responses—all without internet dependency.

---

## 🚀 Live Demo

🔗 [Click here to try it live](https://voice-ai-swart.vercel.app/)

> ⚠️ Note: Some offline features (like Whisper.cpp) may require a local environment to function fully.

---

## 🧠 Features

- 🎤 **Voice Recording**: Record and transcribe speech in-browser.
- 🤖 **Offline STT**: Uses [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) for local speech-to-text.
- 🗣️ **Offline TTS**: Speak responses using browser TTS or future integration with Coqui TTS.
- 📦 **No API Key Needed**: No reliance on external services like OpenAI or Groq.
- 📱 **Mobile PWA Ready**: Installable as a Progressive Web App.

---

## 🛠️ Technologies Used

- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Whisper.cpp (local STT)](https://github.com/ggerganov/whisper.cpp)
- Web APIs (MediaRecorder, Web Speech API)
- [Formidable](https://www.npmjs.com/package/formidable) for file parsing

---

## 📂 Local Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/your-username/offline-voice-ai.git
cd offline-voice-ai

