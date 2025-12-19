# GenAm Refactoring - Technical Specification

**Branch**: `feature/genam-refactor-diagnostic-flow`  
**Date**: December 19, 2025  
**Priority**: HIGH - Complete Phase 1 before Phase 2

---

## 🎯 PHASE 1: Core Logic, GenAm Switch, & Diagnostic Flow

### 1. GLOBAL ACCENT MIGRATION

**Objective**: Replace all RP (Received Pronunciation) references with General American (GenAm).

**Files to Update**:
- `src/lib/prompt-builder.ts` - System instruction text
- `src/app/page.tsx` - UI labels
- `src/app/report/page.tsx` - Report labels
- `src/app/settings/page.tsx` - Settings descriptions
- `src/types/index.ts` - Type comments/descriptions
- `README.md` - Documentation
- `.github/copilot-instructions.md` - Project description

**Search & Replace Rules**:
```
"Modern RP" → "General American"
"RP" → "GenAm"
"Received Pronunciation" → "Network American"
"British English" → "American English"
"British accent" → "American accent"
"non-rhotic" → "rhotic"
"British" → "American"
```

**CRITICAL CONSTRAINT**: 
- **DO NOT** alter the pedagogical logic (teaching methods, correction patterns, drill structures)
- **ONLY** change the target accent standard
- Preserve all existing code structure, function names, variable names

**Phonetic Changes to Make**:
- Update example phonemes from RP to GenAm equivalents:
  - `/ɑː/` (British "bath") → `/æ/` (American "bath")
  - `/ɒ/` (British "lot") → `/ɑ/` (American "lot")
  - `/ɔː/` (British "thought") → `/ɔ/` (American "thought")
  - Remove "non-rhotic /r/" references → add "rhotic /r/" emphasis
  - `/ʌ/` remains but with GenAm quality

---

### 2. CLEANUP - DELETE ASYNC ANALYSIS

**Confirmation**: The Gemini Native Audio model **CAN** produce structured JSON via its text output channel. Therefore, async analysis is **NO LONGER NEEDED**.

**Files to DELETE**:
- `src/app/api/analyze-session/route.ts` - ENTIRE FILE

**Code to REMOVE from `src/hooks/useLiveRPCoach.ts`**:
- `generateSessionReport()` function (lines ~745-780)
- Call to `generateSessionReport()` in `stopSession()` (line ~812)
- `isGeneratingReport` state and related logic
- All references to async report generation

**Files to KEEP** (but modify):
- `src/app/report/page.tsx` - Keep the page, but refactor to display new JSON format
- `STORAGE_KEYS.LAST_SESSION_REPORT` - Keep this to store native audio model's JSON output

**localStorage Structure to MAINTAIN**:
- `RP_LAST_SESSION_REPORT` → Rename to `GENAM_LAST_SESSION_REPORT`
- Purpose: Store the native model's JSON diagnostic data for display on report page

---

### 3. SYSTEM PROMPT UPDATE - DIAGNOSTIC MODE

**File**: `src/lib/prompt-builder.ts`

**New System Prompt Addition** (integrate into existing prompt structure):

```markdown
[DIAGNOSTIC PROTOCOL - GENERAL AMERICAN STANDARD]

You are a world-class expert in General American (GenAm) and Network American pronunciation analysis.

PHASE 1: DIAGNOSTIC CONVERSATION (First 3 Minutes)
1. Engage in natural, casual conversation
2. Extract maximum phonetic data:
   - Vowel quality (/æ/, /ɑ/, /ɔ/, rhotic /r/, etc.)
   - Consonant articulation (/t/ tapping, /l/ quality, /θ/, /ð/)
   - Intonation patterns (rising terminals, statement falls, question rises)
   - Stress patterns (lexical stress, sentence rhythm, weak forms)
   - Overall fluency and intelligibility

3. Compare every utterance against GenAm standard
4. Note deviations from native GenAm speakers

EVALUATION METRICS:
- overall_proficiency_score: 0-100% (100% = native GenAm speaker)
- phonetics_score: 0-100% (individual sounds)
- intonation_score: 0-100% (pitch patterns, melody)
- stress_score: 0-100% (word stress, rhythm, timing)
- qualitative_evaluation: Brief text description of strengths/weaknesses

CRITICAL JSON OUTPUT REQUIREMENT:
At exactly 3:00 minutes (when you receive "DIAGNOSTIC_COMPLETE" signal):

1. Output a JSON object in your TEXT channel (do NOT verbalize this):
```json
{
  "diagnostic_complete": true,
  "timestamp": "2025-12-19T10:30:00Z",
  "overall_proficiency_score": 67,
  "phonetics_score": 60,
  "intonation_score": 75,
  "stress_score": 70,
  "qualitative_evaluation": "Strong intonation with native-like pitch range. Phonetics show consistent /æ/ → /ɛ/ substitution and non-rhotic /r/ (British influence). Stress patterns generally accurate but occasional misplaced emphasis in compounds.",
  "focus_phonemes": ["/æ/", "rhotic /r/", "/t/ tapping"],
  "exercise_types": ["minimal_pairs", "sentence_drills", "stress_patterns"],
  "priority_areas": ["vowel_quality", "r_pronunciation", "flap_t"]
}
```

2. Immediately after outputting JSON, verbalize a brief summary:
   "Based on our conversation, your General American proficiency is [X]%. Your intonation is excellent, but let's work on vowel sounds, especially the /æ/ vowel. Ready to practice?"

PHASE 2: TARGETED DRILLS (After 3:00 mark)
- Use data from diagnostic JSON to shape exercises
- Follow strict exercise loop: 2 phoneme drills → 1 intonation drill → 1 stress pattern drill → repeat
- Prioritize detected weaknesses (priority_areas)
- Frequently use words/phrases the user said during conversation
- Ensure diversity across all three categories

IMPORTANT CONSTRAINTS:
- If diagnostic conversation is too short (<2 min actual speech), ask user to continue talking
- Only evaluate conversation portion (first 3 min), NOT the exercise drills
- Exercise portion is for practice only, not assessment

DATA TRACKING FOR EXERCISES:
- Track words used in diagnostic conversation
- Reuse those words in drills for familiarity
- Example: If user said "water" with non-rhotic /r/, drill "water" vs "waiter" (rhotic contrast)
```

**Implementation Location**:
- Add this to `buildBenchmarkMode()` in `prompt-builder.ts`
- Also add to `buildContinuousMode()` with note: "Diagnostic already complete. Continue drills from previous session."

---

### 4. SESSION FLOW & 3-MINUTE TIMER

**File**: `src/hooks/useLiveRPCoach.ts`

**New State Variables**:
```typescript
const [diagnosticTimeRemaining, setDiagnosticTimeRemaining] = useState(180); // 3 min = 180 sec
const [diagnosticComplete, setDiagnosticComplete] = useState(false);
```

**Timer Implementation** (add to useEffect):
```typescript
// Diagnostic countdown timer
useEffect(() => {
  if (!isConnected || diagnosticComplete || isPaused) return;

  const interval = setInterval(() => {
    setDiagnosticTimeRemaining(prev => {
      const newTime = prev - 1;
      
      // At 0, trigger diagnostic completion
      if (newTime === 0) {
        triggerDiagnosticComplete();
        return 0;
      }
      
      return newTime;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isConnected, diagnosticComplete, isPaused]);
```

**Trigger Function**:
```typescript
const triggerDiagnosticComplete = useCallback(() => {
  if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
  
  console.log('⏰ 3-minute diagnostic complete - requesting JSON report');
  
  // Send signal to model
  wsRef.current.send(JSON.stringify({
    clientContent: {
      turns: [{
        role: 'user',
        parts: [{ text: 'DIAGNOSTIC_COMPLETE' }]
      }],
      turnComplete: true
    }
  }));
  
  setDiagnosticComplete(true);
}, []);
```

**UI Display** (add to `page.tsx`):
```tsx
{/* Diagnostic Timer - Only show during first 3 minutes */}
{isConnected && !diagnosticComplete && (
  <div className="px-6 py-3 bg-blue-600/80 backdrop-blur-lg rounded-xl text-white font-bold text-lg shadow-lg">
    ⏱️ Diagnostic: {Math.floor(diagnosticTimeRemaining / 60)}:{(diagnosticTimeRemaining % 60).toString().padStart(2, '0')}
  </div>
)}
```

---

### 5. REAL-TIME UI UPDATES - JSON PARSING

**File**: `src/hooks/useLiveRPCoach.ts`

**New State**:
```typescript
const [currentScores, setCurrentScores] = useState<{
  overall: number | null;
  phonetics: number | null;
  intonation: number | null;
  stress: number | null;
}>({
  overall: null,
  phonetics: null,
  intonation: null,
  stress: null
});
```

**JSON Parser** (add to `handleWebSocketMessage`):
```typescript
// Handle text responses (log to transcript + parse JSON)
if (part.text) {
  const serverContent = part.text.trim();
  
  // Check for JSON diagnostic report
  const jsonMatch = serverContent.match(/\{[\s\S]*"diagnostic_complete"\s*:\s*true[\s\S]*\}/);
  
  if (jsonMatch) {
    try {
      const diagnosticData = JSON.parse(jsonMatch[0]);
      
      console.log('📊 Diagnostic JSON received:', diagnosticData);
      
      // Update scores immediately
      setCurrentScores({
        overall: diagnosticData.overall_proficiency_score,
        phonetics: diagnosticData.phonetics_score,
        intonation: diagnosticData.intonation_score,
        stress: diagnosticData.stress_score
      });
      
      // Save to localStorage
      localStorage.setItem(
        STORAGE_KEYS.LAST_SESSION_REPORT,
        JSON.stringify(diagnosticData)
      );
      
      // Play notification sound/animation
      playDiagnosticCompleteNotification();
      
      // Don't add JSON to transcript
      return;
    } catch (err) {
      console.error('Failed to parse diagnostic JSON:', err);
    }
  }
  
  // Regular text - add to transcript
  if (serverContent) {
    const entry: TranscriptEntry = {
      timestamp: Date.now(),
      speaker: 'model',
      text: serverContent,
    };
    
    transcriptLogRef.current = [...transcriptLogRef.current, entry];
    setTranscriptLog(transcriptLogRef.current);
  }
}
```

**Notification Function**:
```typescript
const playDiagnosticCompleteNotification = useCallback(() => {
  // Visual notification
  setDiagnosticComplete(true);
  
  // Play sound (optional - use Web Audio API)
  if (audioContextRef.current) {
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    oscillator.frequency.value = 800; // Hz
    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(audioContextRef.current.currentTime + 0.5);
  }
  
  console.log('🎉 Diagnostic complete notification triggered');
}, []);
```

---

### 6. UI SCORE BANNER UPDATES

**File**: `src/app/page.tsx`

**During Active Session** (add to session UI):
```tsx
{/* Score Banner - Shows after diagnostic complete */}
{diagnosticComplete && currentScores.overall !== null && (
  <div className="mb-4 px-6 py-4 bg-gradient-to-r from-green-600/80 to-emerald-600/80 backdrop-blur-lg rounded-xl text-white shadow-lg animate-fade-in">
    <div className="text-center">
      <div className="text-sm font-medium mb-1">Your GenAm Proficiency</div>
      <div className="text-4xl font-black">{currentScores.overall}%</div>
      <div className="text-xs mt-2 opacity-90">
        Phonetics: {currentScores.phonetics}% | 
        Intonation: {currentScores.intonation}% | 
        Stress: {currentScores.stress}%
      </div>
    </div>
  </div>
)}
```

**Home Page** (update existing banner):
```tsx
{lastOverallScore !== null && (
  <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
    <span className="text-gray-300 text-lg font-medium">Last Session GenAm Proficiency:</span>
    <span className={`text-3xl font-black ${
      lastOverallScore >= 71 ? 'text-green-400' :
      lastOverallScore >= 41 ? 'text-yellow-400' :
      'text-red-400'
    }`}>
      {lastOverallScore}%
    </span>
  </div>
)}
```

---

### 7. BACKGROUND AUDIO - iOS LOCK SCREEN SUPPORT

**File**: `src/hooks/useLiveRPCoach.ts`

**Issue**: When iPhone screen locks, iOS suspends WebSocket and audio processing.

**Solution**: Combine Wake Lock API + Audio Context Keep-Alive + Service Worker (if needed)

**Implementation**:

```typescript
// Enhanced wake lock with audio keep-alive
const requestWakeLock = useCallback(async () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Screen Wake Lock (prevents screen from turning off)
    if ('wakeLock' in navigator) {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      console.log('🔒 Screen wake lock acquired');
      
      wakeLockRef.current.addEventListener('release', () => {
        console.log('🔓 Screen wake lock released');
      });
    }
    
    // Audio Keep-Alive (keeps audio processing active on iOS)
    // iOS requires an active audio context to maintain WebSocket connections
    if (audioContextRef.current) {
      // Create a silent audio node that keeps context alive
      const silentNode = audioContextRef.current.createGain();
      silentNode.gain.value = 0; // Silent
      silentNode.connect(audioContextRef.current.destination);
      
      // Play silent tone continuously (keeps iOS audio session active)
      const oscillator = audioContextRef.current.createOscillator();
      oscillator.frequency.value = 1; // 1 Hz (inaudible)
      oscillator.connect(silentNode);
      oscillator.start();
      
      console.log('🔊 Audio keep-alive started (iOS background support)');
    }
  } catch (err) {
    console.warn('Wake lock/audio keep-alive not available:', err);
  }
}, []);

// Request on session start
useEffect(() => {
  if (isConnected) {
    requestWakeLock();
  }
}, [isConnected, requestWakeLock]);
```

**Additional iOS-specific Metadata** (add to `public/manifest.json` if not exists):
```json
{
  "name": "GenAm Pronunciation Coach",
  "short_name": "GenAm Coach",
  "description": "Real-time General American pronunciation coaching",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#1e293b",
  "categories": ["education", "productivity"],
  "prefer_related_applications": false
}
```

**iOS-specific HTML meta tags** (add to `src/app/layout.tsx`):
```tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="GenAm Coach" />
```

---

## 📊 PHASE 2: Advanced Visualization (DO AFTER PHASE 1)

### 1. HOME PAGE REDESIGN

**File**: `src/app/page.tsx`

**Remove Section**: Delete everything between "Last Session Proficiency Banner" and footer.

**Insert**: New Progress Graph Component in that space.

---

### 2. PROGRESS GRAPH COMPONENT

**New File**: `src/components/ProgressChart.tsx`

**Library**: Use `recharts` (already React-friendly)

**Installation**:
```bash
npm install recharts
```

**Component Structure**:
```tsx
'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { STORAGE_KEYS } from '@/types';

type TimeRange = '10days' | '100days' | 'all';
type MetricType = 'overall' | 'phonetics' | 'intonation' | 'stress';

interface DataPoint {
  date: string;
  overall: number;
  phonetics: number;
  intonation: number;
  stress: number;
}

export default function ProgressChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>('10days');
  const [metric, setMetric] = useState<MetricType>('overall');
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    loadHistoricalData();
  }, [timeRange]);

  const loadHistoricalData = () => {
    // Load from localStorage
    const historyStr = localStorage.getItem(STORAGE_KEYS.PROFICIENCY_HISTORY);
    if (!historyStr) {
      setData([]);
      return;
    }

    const history: DataPoint[] = JSON.parse(historyStr);
    
    // Filter by time range
    const now = new Date();
    const filtered = history.filter(point => {
      const pointDate = new Date(point.date);
      const daysDiff = Math.floor((now.getTime() - pointDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (timeRange === '10days') return daysDiff <= 10;
      if (timeRange === '100days') return daysDiff <= 100;
      return true; // 'all'
    });

    setData(filtered);
  };

  return (
    <div className="bg-gradient-to-br from-gray-900/60 via-slate-900/60 to-gray-900/60 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
      {/* Header with Dropdowns */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Progress Over Time
        </h3>
        
        <div className="flex gap-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="10days">Last 10 Days</option>
            <option value="100days">Last 100 Days</option>
            <option value="all">All Time</option>
          </select>

          {/* Metric Selector */}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricType)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="overall">Overall Proficiency</option>
            <option value="phonetics">Phonetics</option>
            <option value="intonation">Intonation</option>
            <option value="stress">Stress Patterns</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="date" 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={
              metric === 'overall' ? '#3b82f6' :
              metric === 'phonetics' ? '#10b981' :
              metric === 'intonation' ? '#f59e0b' :
              '#8b5cf6'
            }
            strokeWidth={3}
            dot={{ r: 5 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Empty State */}
      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">
            No session data yet. Complete your first session to see progress!
          </p>
        </div>
      )}
    </div>
  );
}
```

---

### 3. DATA STORAGE STRUCTURE

**New localStorage Key**:
```typescript
// In src/types/index.ts
export const STORAGE_KEYS = {
  // ... existing keys
  PROFICIENCY_HISTORY: 'GENAM_PROFICIENCY_HISTORY',
} as const;
```

**Data Format**:
```typescript
// Array of historical data points
[
  {
    "date": "2025-12-19T10:30:00Z",
    "overall": 67,
    "phonetics": 60,
    "intonation": 75,
    "stress": 70
  },
  {
    "date": "2025-12-20T14:15:00Z",
    "overall": 71,
    "phonetics": 65,
    "intonation": 78,
    "stress": 72
  }
]
```

**Save Function** (in `useLiveRPCoach.ts`):
```typescript
const saveToHistory = useCallback((diagnosticData: any) => {
  const historyStr = localStorage.getItem(STORAGE_KEYS.PROFICIENCY_HISTORY);
  const history: DataPoint[] = historyStr ? JSON.parse(historyStr) : [];
  
  history.push({
    date: new Date().toISOString(),
    overall: diagnosticData.overall_proficiency_score,
    phonetics: diagnosticData.phonetics_score,
    intonation: diagnosticData.intonation_score,
    stress: diagnosticData.stress_score
  });
  
  localStorage.setItem(STORAGE_KEYS.PROFICIENCY_HISTORY, JSON.stringify(history));
}, []);
```

---

## 🧪 TESTING CHECKLIST

### Phase 1:
- [ ] All "RP" → "GenAm" replacements verified
- [ ] Async analysis code completely removed
- [ ] 3-minute timer counts down correctly
- [ ] Model outputs JSON at 3:00 mark
- [ ] JSON parsed and scores displayed immediately
- [ ] Notification sound/animation plays
- [ ] Exercise loop follows 2-phoneme, 1-intonation, 1-stress pattern
- [ ] Session continues on iPhone with locked screen
- [ ] Report page displays new JSON format

### Phase 2:
- [ ] Progress graph component renders
- [ ] Time range selector works (10 days, 100 days, all)
- [ ] Metric selector switches lines correctly
- [ ] Touch interaction shows vertical line with value
- [ ] Data persists in localStorage
- [ ] Empty state displays when no data

---

## 📝 NOTES FOR NEW CHAT

When starting implementation in a new chat, provide this document and ask:

1. "I have the technical spec. Should I start with Phase 1 Step 1 (Global Accent Migration)?"
2. "Confirm you're on branch `feature/genam-refactor-diagnostic-flow`"
3. "Any questions before we begin?"

This ensures continuity and prevents re-asking questions already answered here.

---

**END OF SPECIFICATION**
