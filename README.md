# RP Native Coach

Real-time Modern RP (Received Pronunciation) voice coaching app powered by Gemini 2.5 Flash Native Audio.

## 🎯 Features

- **Full-Duplex Voice Coaching**: Real-time bidirectional audio with Gemini's native Server-Side VAD
- **Personalized Learning**: Steve, your AI coach, knows your name, background, and progress
- **Continuity Between Sessions**: Automatic tracking of your pronunciation journey
- **Progress Dashboard**: Visual feedback on accuracy, mastery, and growth over time
- **Session History**: Review past sessions and achievements
- **Auto-Reconnection**: Robust WebSocket handling with exponential backoff

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- A Gemini API key with access to Gemini 2.5 Flash Native Audio

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Enable Microphone

Make sure to allow microphone access when prompted by your browser.

## 🧠 How It Works

### The 3-Part Dynamic System Prompt

1. **User Profile Block**: Steve knows you're Peter, 54, HR Director at KINEX BEARINGS in Slovakia
2. **Dynamic Data Block**: 
   - First session: Benchmark mode (diagnostic interview)
   - Returning sessions: Continuous mode (focused drills based on previous metrics)
3. **Static Role & Methodology**: Core RP teaching principles and metrics reporting mandate

### Data Persistence

All progress is stored locally in your browser:
- `RP_INITIAL_BENCHMARK`: Your first diagnostic session
- `RP_CURRENT_STATUS`: Latest metrics
- `RP_SESSION_HISTORY`: Last 10 sessions with achievements

### Metrics Tracked

- RP Level (A2, B1, B2, C1)
- Current Accuracy (0-100%)
- Confidence Score (Gemini's assessment certainty)
- Residual Errors (specific pronunciation issues)
- Prosody Gaps (intonation, stress patterns)
- Pitch Variance (measured in semitones)
- Focus Areas (primary & secondary targets)

## 📱 Usage

1. Click "Start Coaching Session"
2. Allow microphone access
3. Speak naturally with Steve
4. Receive real-time pronunciation feedback
5. Watch your progress improve over time
6. Use "Save Checkpoint" to manually save progress
7. Click "End Session" when finished

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Gemini 2.5 Flash Native Audio (Multimodal Live API)
- **Storage**: localStorage (client-side)

## 🔧 Configuration

### Voice Configuration

The app uses the "Puck" voice (British English) for Steve. To change:

Edit `src/hooks/useLiveRPCoach.ts`:
```typescript
voiceConfig: {
  prebuiltVoiceConfig: {
    voiceName: 'Puck', // Change to other voice
  },
},
```

### User Profile

To customize the student profile, edit `src/types/index.ts`:
```typescript
export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'YourName',
  age: 54,
  // ... customize other fields
};
```

## 📊 Session Metrics Format

Gemini sends metrics via the text channel after each response:

```json
{
  "metrics_update": {
    "session_id": "session_1234567890_abc123",
    "timestamp": "2025-12-14T10:30:00.000Z",
    "rp_level": "B2",
    "current_accuracy": 78,
    "confidence_score": 85,
    "next_primary_focus": "/ɔː/ vowel in connected speech",
    "...": "..."
  },
  "trigger_event": "NONE"
}
```

## 🐛 Troubleshooting

### WebSocket Connection Issues
- Check your API key in `.env.local`
- Ensure you have network connectivity
- The app will auto-reconnect with exponential backoff

### Microphone Not Working
- Check browser permissions
- Ensure no other app is using the microphone
- Try a different browser (Chrome/Edge recommended)

### No Metrics Updates
- Check browser console for errors
- Verify Gemini is sending text channel responses
- Use "Save Checkpoint" to manually trigger a save

## 📄 License

ISC

## 🙏 Acknowledgments

- Gemini 2.5 Flash Native Audio by Google
- Modern RP phonetic standards by Wells, Roach, Catford, Crystal
