# PHASE 1: ASYNC ANALYSIS ARCHITECTURE - IMPLEMENTATION PLAN

## Branch: feature/async-analysis

## Overview
Transform from synchronous JSON metrics (causing latency) to asynchronous post-session analysis. Phase 1 focuses on **eliminating live session JSON** while maintaining robust transcript logging for Phase 2 analysis.

---

## ✅ PREREQUISITES CHECKLIST
- [x] New branch created: `feature/async-analysis`
- [ ] All pending changes on `feature/settings-page` committed/pushed
- [ ] Environment variable `GEMINI_API_KEY` verified in `.env.local`
- [ ] Dev server tested and working: `npm run dev`

---

## 🎯 PHASE 1 OBJECTIVES

### Goal: Zero-Latency Live Sessions
1. **Remove JSON metrics reporting** from live session prompt
2. **Add verbal feedback mandate** - Coach must explicitly state "Correct", "Incorrect", "Almost", etc.
3. **Implement transcript logging** - Track all user and model utterances with timestamps
4. **Preserve speaker attribution** - Clear distinction between Peter's speech and Alex's responses
5. **Test audio flow** - Ensure removal of JSON doesn't break WebSocket communication

### Success Criteria
- ✅ No JSON parsing errors in console
- ✅ Live session feels faster/more responsive
- ✅ Transcript logs accurately capture conversation
- ✅ Verbal feedback is explicit and trackable

---

## 📋 IMPLEMENTATION STEPS

### STEP 1: Update Type Definitions (`src/types/index.ts`)

#### Add New Types
```typescript
// Transcript entry for logging
export interface TranscriptEntry {
  timestamp: number;           // Unix timestamp
  speaker: 'user' | 'model';   // Who spoke
  text: string;                // What was said
}

// Analysis item (for Phase 2)
export interface AnalysisItem {
  name: string;                // e.g., "/r/" or "Wh-Question"
  attempts: number;
  score: number;               // 0-100%
  status: 'NEEDS_WORK' | 'IMPROVING' | 'GOOD' | 'MASTERED';
}

// Category result (for Phase 2)
export interface CategoryResult {
  weighted_score: number;      // 0-100%
  items: AnalysisItem[];
}

// Async session report (for Phase 2)
export interface AsyncSessionReport {
  session_id: string;
  timestamp: string;
  duration_minutes: number;
  categories: {
    phonetics: CategoryResult;
    intonation: CategoryResult;
    stress_rhythm: CategoryResult;
  };
  qualitative_notes: string;
  next_session_recommendation: {
    primary_focus: string;
    secondary_focus: string;
    warmup_topic: string;
  };
}
```

#### Update Storage Keys
```typescript
export const STORAGE_KEYS = {
  // ... existing keys ...
  TRANSCRIPT_LOG: 'RP_TRANSCRIPT_LOG',           // New: Session transcript
  LAST_SESSION_REPORT: 'RP_LAST_SESSION_REPORT', // New: For Phase 2
} as const;
```

**Commit checkpoint:** `git commit -m "Phase 1: Add transcript and async report types"`

---

### STEP 2: Update Prompt Builder (`src/lib/prompt-builder.ts`)

#### A. Remove Metrics Mandate from STATIC_ROLE
**Find and DELETE the entire `[MANDATE: METRICS REPORTING]` section** (approx lines 168-230)

#### B. Add Verbal Feedback Mandate
**Add to STATIC_ROLE** (after TEACHING PRINCIPLES, before end):

```typescript
[VERBAL FEEDBACK MANDATE - CRITICAL FOR POST-ANALYSIS]
You must NEVER output JSON during the live session. All metrics will be analyzed asynchronously after the session.

Instead, provide EXPLICIT VERBAL FEEDBACK after every user utterance:
- If CORRECT: Say "Perfect", "Excellent", "Spot on", "That's right", "Good"
- If PARTIALLY CORRECT: Say "Better", "Almost", "Getting there", "Closer", "Not quite"
- If INCORRECT: Say "No", "Incorrect", "Not yet", "Let's try again", followed by specific correction

MANDATORY: Always explicitly state:
1. **What the error is**: "That was a flat intonation" or "You used an American R"
2. **What the target should be**: "The pitch should rise at the end"
3. **How to fix it**: "Open your jaw more and round your lips"

Never just repeat the correct form without labeling the user's attempt. The post-session analyzer relies on your verbal cues to calculate accuracy.
```

**Commit checkpoint:** `git commit -m "Phase 1: Replace JSON mandate with verbal feedback protocol"`

---

### STEP 3: Update Live Hook (`src/hooks/useLiveRPCoach.ts`)

#### A. Add Transcript State
```typescript
// Add to state declarations (around line 30)
const [transcriptLog, setTranscriptLog] = useState<TranscriptEntry[]>([]);
```

#### B. Add Transcript Ref
```typescript
// Add to refs section (around line 50)
const transcriptLogRef = useRef<TranscriptEntry[]>([]);
```

#### C. Remove JSON Parsing Logic
**Find and DELETE** the `parseMetricsUpdate` function (approx lines 400-450)

**Find and DELETE** the metrics parsing code in WebSocket message handler (approx lines 600-650):
```typescript
// DELETE THIS BLOCK:
if (serverContent.includes('{') && serverContent.includes('metrics_update')) {
  parseMetricsUpdate(serverContent);
}
```

#### D. Add Transcript Logging
**Replace the deleted parsing code with:**

```typescript
// Log model response to transcript
if (serverContent && serverContent.trim()) {
  const entry: TranscriptEntry = {
    timestamp: Date.now(),
    speaker: 'model',
    text: serverContent.trim(),
  };
  
  transcriptLogRef.current = [...transcriptLogRef.current, entry];
  setTranscriptLog(transcriptLogRef.current);
  
  // Save to localStorage periodically (every 5 entries)
  if (transcriptLogRef.current.length % 5 === 0) {
    localStorage.setItem(
      STORAGE_KEYS.TRANSCRIPT_LOG,
      JSON.stringify(transcriptLogRef.current)
    );
  }
}
```

#### E. Add User Speech Logging
**Find the audio processor section** (around line 250) and add logging when user speaks:

```typescript
// In onaudioprocess callback, after sending to WebSocket:
// Log user audio (we'll use speech recognition in Phase 2, for now just log events)
if (pcmData.length > 0) {
  // Check if significant audio (not just silence)
  const rms = Math.sqrt(
    processedData.reduce((sum, val) => sum + val * val, 0) / processedData.length
  );
  
  if (rms > 0.01) { // Threshold for speech detection
    const entry: TranscriptEntry = {
      timestamp: Date.now(),
      speaker: 'user',
      text: '[AUDIO_DETECTED]', // Placeholder - Phase 2 will add transcription
    };
    
    transcriptLogRef.current = [...transcriptLogRef.current, entry];
    setTranscriptLog(transcriptLogRef.current);
  }
}
```

#### F. Save Transcript on Session End
**Find `stopSession` function** and add:

```typescript
const stopSession = useCallback(() => {
  // ... existing cleanup code ...
  
  // Save final transcript
  if (transcriptLogRef.current.length > 0) {
    localStorage.setItem(
      STORAGE_KEYS.TRANSCRIPT_LOG,
      JSON.stringify(transcriptLogRef.current)
    );
    console.log(`Session ended. Transcript entries: ${transcriptLogRef.current.length}`);
  }
  
  // Clear transcript for next session
  transcriptLogRef.current = [];
  setTranscriptLog([]);
  
  // ... rest of cleanup ...
}, []);
```

#### G. Update Return Interface
```typescript
// Update UseLiveRPCoachReturn interface
interface UseLiveRPCoachReturn {
  // ... existing properties ...
  transcriptLog: TranscriptEntry[]; // Add this
}

// Update return statement
return {
  // ... existing returns ...
  transcriptLog,
};
```

**Commit checkpoint:** `git commit -m "Phase 1: Implement transcript logging and remove JSON parsing"`

---

### STEP 4: Update UI for Debugging (`src/app/page.tsx`)

#### Optional: Add Transcript Viewer
Add below the session timer (only visible during active session):

```typescript
{isConnected && transcriptLog.length > 0 && (
  <details className="mt-4 p-4 bg-gray-50 rounded-lg">
    <summary className="cursor-pointer font-medium">
      Transcript ({transcriptLog.length} entries)
    </summary>
    <div className="mt-2 max-h-60 overflow-y-auto space-y-1 text-sm">
      {transcriptLog.slice(-20).map((entry, idx) => (
        <div
          key={idx}
          className={`p-2 rounded ${
            entry.speaker === 'user' ? 'bg-blue-50' : 'bg-green-50'
          }`}
        >
          <span className="font-semibold">
            {entry.speaker === 'user' ? 'Peter' : 'Alex'}:
          </span>{' '}
          {entry.text}
        </div>
      ))}
    </div>
  </details>
)}
```

**Commit checkpoint:** `git commit -m "Phase 1: Add transcript viewer for debugging"`

---

## 🧪 TESTING PROTOCOL

### Test 1: Baseline Functionality
1. Run `npm run dev`
2. Start a session
3. **Expected:** No JSON parsing errors in console
4. **Expected:** Audio flows normally (both directions)
5. **Expected:** Coach responds without delays

### Test 2: Verbal Feedback
1. Start session
2. Speak a few sentences
3. **Expected:** Coach explicitly says "Correct", "Incorrect", "Almost", etc.
4. **Expected:** Coach names errors: "That was a flat intonation"

### Test 3: Transcript Logging
1. Open DevTools → Console
2. After session ends, run: `JSON.parse(localStorage.getItem('RP_TRANSCRIPT_LOG'))`
3. **Expected:** Array of transcript entries
4. **Expected:** Entries have timestamps, speaker, text

### Test 4: No Latency Regression
1. Compare session responsiveness to previous version
2. **Expected:** Faster responses (no JSON generation overhead)

---

## 🚨 ROLLBACK PLAN

If Phase 1 breaks functionality:
```bash
git reset --hard HEAD~[number_of_commits]
git checkout feature/settings-page
```

---

## 📦 DELIVERABLES

- [ ] Updated `src/types/index.ts` with new types
- [ ] Modified `src/lib/prompt-builder.ts` (removed JSON mandate, added verbal feedback)
- [ ] Refactored `src/hooks/useLiveRPCoach.ts` (transcript logging, no JSON parsing)
- [ ] Optional: Transcript viewer in `src/app/page.tsx`
- [ ] All tests passing
- [ ] Clean commit history with descriptive messages

---

## 🔜 PHASE 2 PREVIEW

**Not in this phase** - reserved for next chat session:
- Create `/api/analyze-session` endpoint
- Implement Gemini 2.5 Flash analyzer with categorization logic
- Parse transcript for accuracy calculation
- Generate `AsyncSessionReport` JSON
- Update prompt builder to inject report into next session

---

## 🎓 KEY PRINCIPLES

1. **Separation of Concerns:** Live session = UX. Analysis = Accuracy.
2. **Data First:** Transcript is the source of truth.
3. **Explicit Feedback:** Coach must verbalize corrections for Phase 2 parsing.
4. **No Regressions:** Audio flow must remain unaffected.

---

**Ready to implement?** Start with Step 1 and commit after each major change. Good luck! 🚀
