# PHASE 2: ASYNC SESSION ANALYZER - IMPLEMENTATION PLAN

## Branch: feature/async-analysis (continued)

## ⚠️ PREREQUISITES
- ✅ Phase 1 completed and tested
- ✅ Transcript logging working correctly
- ✅ Verbal feedback protocol validated
- ✅ No JSON parsing in live sessions
- ✅ All Phase 1 commits pushed

---

## 🎯 PHASE 2 OBJECTIVES

### Goal: Deep Post-Session Analysis
1. **Create analyzer API endpoint** - `/api/analyze-session`
2. **Implement hierarchical categorization** - Phonetics > Intonation > Stress
3. **Calculate weighted accuracy scores** - Based on attempt counts
4. **Generate structured JSON report** - `AsyncSessionReport`
5. **Inject report into next session** - Intelligent continuity

### Success Criteria
- ✅ Analyzer correctly parses verbal feedback ("Correct", "Incorrect", "Almost")
- ✅ Categories are strictly prioritized (Phonetics first, then Intonation, then Stress)
- ✅ Weighted scores accurate (0-100%)
- ✅ Next session receives condensed performance matrix
- ✅ Coach adapts drill focus based on report

---

## 📋 IMPLEMENTATION STEPS

### STEP 1: Create Analyzer API Endpoint

#### File: `src/app/api/analyze-session/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { TranscriptEntry, AsyncSessionReport } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANALYZER_MODEL = 'gemini-2.5-flash-latest'; // Text-only model

// Analyzer System Prompt (see STEP 2 for full prompt)
const ANALYZER_PROMPT = `...`;

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const { transcriptLog, sessionId } = await request.json();

    if (!transcriptLog || !Array.isArray(transcriptLog)) {
      return NextResponse.json(
        { error: 'Invalid transcript log' },
        { status: 400 }
      );
    }

    // Convert transcript to readable format
    const transcriptText = formatTranscript(transcriptLog as TranscriptEntry[]);

    // Calculate session duration
    const duration = calculateDuration(transcriptLog as TranscriptEntry[]);

    // Call Gemini API for analysis
    const analysisResult = await analyzeTranscript(transcriptText);

    // Build final report
    const report: AsyncSessionReport = {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      duration_minutes: duration,
      ...analysisResult,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function formatTranscript(log: TranscriptEntry[]): string {
  return log
    .map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-GB');
      const speaker = entry.speaker === 'user' ? 'PETER' : 'ALEX';
      return `[${time}] ${speaker}: ${entry.text}`;
    })
    .join('\n');
}

function calculateDuration(log: TranscriptEntry[]): number {
  if (log.length < 2) return 0;
  const start = log[0].timestamp;
  const end = log[log.length - 1].timestamp;
  return Math.round((end - start) / 1000 / 60); // minutes
}

async function analyzeTranscript(transcriptText: string): Promise<Partial<AsyncSessionReport>> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ANALYZER_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${ANALYZER_PROMPT}\n\n--- TRANSCRIPT TO ANALYZE ---\n${transcriptText}`
          }]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent analysis
          responseModalities: ['text'],
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const analysisText = data.candidates[0].content.parts[0].text;

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/) || 
                    analysisText.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('No JSON found in analysis response');
  }

  const jsonText = jsonMatch[1] || jsonMatch[0];
  return JSON.parse(jsonText);
}
```

**Commit checkpoint:** `git commit -m "Phase 2: Create analyzer API endpoint skeleton"`

---

### STEP 2: Implement Analyzer Prompt

#### Add to `src/app/api/analyze-session/route.ts`

```typescript
const ANALYZER_PROMPT = `
ROLE: Forensic Linguistics Analyst (British RP)
INPUT: Coaching session transcript between ALEX (coach) and PETER (student)
TASK: Quantify PETER's pronunciation performance based on ALEX's verbal feedback

METHODOLOGY & CALCULATIONS:

1. EXTRACT DRILLS:
   - Scan for utterances where ALEX corrects PETER
   - Assign PERCENTAGE SCORE based on ALEX's verbal reaction:
     * "Incorrect" / "No" / "Not yet" / "Wrong" / Explicit correction given = 0%
     * "Better" / "Almost" / "Getting there" / "Closer" / "Not quite" / "Partial" = 50%
     * "Perfect" / "Excellent" / "Spot on" / "Correct" / "Good" / "That's right" = 100%

2. CATEGORIZE (Strict Priority - DO NOT mix categories):
   I. PHONETICS (Individual sounds only):
      - Examples: "/r/", "/ɔː/", "/θ/", "/ð/", "/æ/", "/ʌ/"
      - Use IPA notation where possible
      
   II. INTONATION (Pitch patterns - use TYPES to save tokens):
      - Types: "Wh-Question", "Yes/No Question", "Statement", "Conditional Sentence", 
               "Emotion: Surprise", "Emotion: Sadness", "List Intonation"
      - DO NOT quote full sentences
      
   III. STRESS & RHYTHM (Word stress and rhythm patterns):
      - Specific words: "Photograph", "Photography", "Photographic"
      - Pattern types: "Iambic", "Trochaic", "Weak Forms", "Connected Speech"

3. CALCULATE SCORES (CRITICAL - Follow exact formula):
   
   A. Item Score Calculation:
      - For each specific item (e.g., "/r/" or "Wh-Question"):
      - Sum all attempt scores
      - Divide by number of attempts
      - Result: 0-100%
      - Example: /r/ attempts: [0, 0, 50, 50, 100] → Score = 200/5 = 40%
   
   B. Category Score Calculation (WEIGHTED MEAN):
      - For each category (Phonetics, Intonation, Stress):
      - Multiply each item score by its attempt count
      - Sum all weighted scores
      - Divide by total attempts across all items in category
      - Result: 0-100%
      - Example:
        * /r/: 40% (5 attempts) → 40 × 5 = 200
        * /ɔː/: 75% (4 attempts) → 75 × 4 = 300
        * Category: (200 + 300) / (5 + 4) = 500/9 = 55.6%

4. STATUS ASSIGNMENT:
   - 0-40%: "NEEDS_WORK"
   - 41-70%: "IMPROVING"
   - 71-90%: "GOOD"
   - 91-100%: "MASTERED"

OUTPUT FORMAT (Strict JSON - NO markdown, NO extra text):
{
  "categories": {
    "phonetics": {
      "weighted_score": 55,
      "items": [
        { "name": "/r/", "attempts": 10, "score": 40, "status": "NEEDS_WORK" },
        { "name": "/ɔː/", "attempts": 5, "score": 80, "status": "GOOD" }
      ]
    },
    "intonation": {
      "weighted_score": 67,
      "items": [
        { "name": "Wh-Question", "attempts": 3, "score": 100, "status": "MASTERED" },
        { "name": "Yes/No Question", "attempts": 4, "score": 50, "status": "IMPROVING" }
      ]
    },
    "stress_rhythm": {
      "weighted_score": 0,
      "items": []
    }
  },
  "qualitative_notes": "Brief summary: Peter struggles with non-rhotic R, showing 40% accuracy. /ɔː/ vowel is improving (80%). Intonation on Wh-questions is mastered, but Yes/No questions need work.",
  "next_session_recommendation": {
    "primary_focus": "Non-rhotic /r/ in word-final position",
    "secondary_focus": "Yes/No question rising intonation",
    "warmup_topic": "Minimal pairs: car vs cah, far vs fah"
  }
}

CRITICAL RULES:
- Calculate weighted_score EXACTLY as described (weighted mean, not simple average)
- Items must be SPECIFIC (not "R sounds" but "/r/ word-final")
- Categorization is STRICT (never put intonation in phonetics)
- Empty categories have weighted_score: 0 and items: []
- All scores must be integers 0-100
- Output ONLY the JSON object, nothing else
`;
```

**Commit checkpoint:** `git commit -m "Phase 2: Add analyzer prompt with calculation logic"`

---

### STEP 3: Trigger Analysis from Frontend

#### Update `src/hooks/useLiveRPCoach.ts`

Add function to call analyzer:

```typescript
const generateSessionReport = useCallback(async () => {
  if (transcriptLogRef.current.length < 5) {
    console.warn('Transcript too short for meaningful analysis');
    return;
  }

  setIsGeneratingReport(true);

  try {
    const response = await fetch('/api/analyze-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcriptLog: transcriptLogRef.current,
        sessionId: currentSessionIdRef.current || generateSessionId(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    const { report } = await response.json();

    // Save report to localStorage
    localStorage.setItem(
      STORAGE_KEYS.LAST_SESSION_REPORT,
      JSON.stringify(report)
    );

    console.log('Session report generated:', report);
  } catch (err) {
    console.error('Failed to generate session report:', err);
    setError('Failed to analyze session');
  } finally {
    setIsGeneratingReport(false);
  }
}, []);
```

Call it in `stopSession`:

```typescript
const stopSession = useCallback(() => {
  // ... existing cleanup ...
  
  // Generate report if flag is set
  if (shouldGenerateReportRef.current && transcriptLogRef.current.length > 0) {
    generateSessionReport();
  }
  
  // ... rest of cleanup ...
}, [generateSessionReport]);
```

Set flag when session has meaningful content:

```typescript
// In WebSocket message handler, when receiving model responses:
if (transcriptLogRef.current.length > 10) {
  shouldGenerateReportRef.current = true;
}
```

**Commit checkpoint:** `git commit -m "Phase 2: Trigger analysis on session end"`

---

### STEP 4: Inject Report into Next Session

#### Update `src/lib/prompt-builder.ts`

Add helper function for formatting categories:

```typescript
/**
 * Format category for system prompt injection
 */
function formatCategory(name: string, data: CategoryResult): string {
  if (!data.items || data.items.length === 0) return '';
  
  const itemsStr = data.items
    .map(item => `   - ${item.name}: ${item.score}% (${item.attempts}x) [${item.status}]`)
    .join('\n');
  
  return `\n${name.toUpperCase()} (Weighted Avg: ${data.weighted_score}%):\n${itemsStr}`;
}
```

Update `buildContinuousMode` to accept report:

```typescript
function buildContinuousMode(report: AsyncSessionReport): string {
  return `
[ANALYTIC DATA INPUT: ASYNCHRONOUS REPORT FROM PREVIOUS SESSION]

-- PERFORMANCE MATRIX (PRIORITY ORDER) --
${formatCategory('1. Phonetics', report.categories.phonetics)}
${formatCategory('2. Intonation', report.categories.intonation)}
${formatCategory('3. Stress & Rhythm', report.categories.stress_rhythm)}

-- QUALITATIVE NOTES --
${report.qualitative_notes}

-- STRATEGY FOR THIS SESSION --
1. PRIMARY FOCUS: ${report.next_session_recommendation.primary_focus}
2. SECONDARY FOCUS: ${report.next_session_recommendation.secondary_focus}
3. WARMUP: ${report.next_session_recommendation.warmup_topic}

-- SESSION PROTOCOL --
1. **BRIEFING (30 seconds max):** 
   - Greet Peter warmly
   - Briefly explain last session's results using the matrix above
   - Example: "Last time, Phonetics scored ${report.categories.phonetics.weighted_score}% due to /r/ struggles, so we'll focus there today"

2. **QUANTIFY:** 
   - Internally track accuracy for PRIMARY FOCUS on a per-utterance basis
   - Use same verbal feedback protocol ("Correct", "Incorrect", "Almost")

3. **DRILL:** 
   - Start drill on PRIMARY FOCUS immediately after briefing
   - Use minimal pairs, exaggerated articulation, repetition
   - Provide explicit articulatory instructions

4. **SHIFT CONDITION:** 
   - If accuracy > 85% over 10+ attempts
   - IMMEDIATELY shift to SECONDARY FOCUS
   - Verbally acknowledge the shift: "Great! You've mastered [X]. Let's move to [Y]."

5. **MAINTAIN VERBAL FEEDBACK:**
   - Continue explicit labeling for post-analysis
   - Never assume continuity without stating corrections aloud
`;
}
```

Update `buildSystemInstruction` signature:

```typescript
export function buildSystemInstruction(
  reportOrNull: AsyncSessionReport | null,
  userProfile: UserProfile = DEFAULT_USER_PROFILE
): string {
  const parts: string[] = [];

  parts.push(buildUserProfileBlock(userProfile));
  parts.push(META_INSTRUCTION);

  if (reportOrNull === null) {
    parts.push(BENCHMARK_MODE);
  } else {
    parts.push(buildContinuousMode(reportOrNull));
  }

  parts.push(getStaticRole());

  return parts.join('\n\n');
}
```

**Commit checkpoint:** `git commit -m "Phase 2: Inject report into continuous mode prompt"`

---

### STEP 5: Update API to Use Report

#### File: `src/app/api/session/route.ts`

```typescript
export async function POST(request: NextRequest) {
  try {
    // ... existing validation ...

    const body = await request.json();
    const { userProfile, temperature, voiceName } = body;

    // Load last session report instead of old metrics
    let report: AsyncSessionReport | null = null;
    
    // Note: We can't access localStorage server-side
    // Client should send report in request body if available
    if (body.lastReport) {
      report = body.lastReport as AsyncSessionReport;
    }

    // Build system instruction with report
    const systemInstruction = buildSystemInstruction(
      report,
      userProfile || DEFAULT_USER_PROFILE
    );

    // ... rest of function ...
  } catch (error) {
    // ... error handling ...
  }
}
```

#### Update Frontend Hook to Send Report

In `src/hooks/useLiveRPCoach.ts`, modify `startSession`:

```typescript
const startSession = async () => {
  try {
    // Load last report from storage
    const lastReportStr = localStorage.getItem(STORAGE_KEYS.LAST_SESSION_REPORT);
    const lastReport = lastReportStr ? JSON.parse(lastReportStr) : null;

    // Get voice/temperature settings
    const voiceName = localStorage.getItem(STORAGE_KEYS.VOICE_PREFERENCE) || 'Enceladus';
    const temperature = parseFloat(localStorage.getItem(STORAGE_KEYS.TEMPERATURE) || '1.0');

    // Call session API with report
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastReport,
        userProfile: DEFAULT_USER_PROFILE,
        temperature,
        voiceName,
      }),
    });

    // ... rest of startSession ...
  } catch (err) {
    // ... error handling ...
  }
};
```

**Commit checkpoint:** `git commit -m "Phase 2: Complete async analysis pipeline"`

---

## 🧪 TESTING PROTOCOL

### Test 1: Analyzer Accuracy
1. Create mock transcript with known corrections:
   ```json
   [
     {"timestamp": 1000, "speaker": "model", "text": "Say 'car'"},
     {"timestamp": 2000, "speaker": "user", "text": "[AUDIO_DETECTED]"},
     {"timestamp": 3000, "speaker": "model", "text": "No, that was incorrect. You used an American R. Try again with no R sound at the end."},
     {"timestamp": 4000, "speaker": "user", "text": "[AUDIO_DETECTED]"},
     {"timestamp": 5000, "speaker": "model", "text": "Better! Almost there. One more time."},
     {"timestamp": 6000, "speaker": "user", "text": "[AUDIO_DETECTED]"},
     {"timestamp": 7000, "speaker": "model", "text": "Perfect! That's a proper RP /ɑː/ sound."}
   ]
   ```
2. Call `/api/analyze-session` with this transcript
3. **Expected:** `/r/` item with 3 attempts, scores [0, 50, 100], final score ~50%

### Test 2: Category Prioritization
1. Run session with mixed errors (phonetics + intonation)
2. Check report JSON
3. **Expected:** Phonetics items listed first, intonation second, no mixing

### Test 3: Weighted Score Math
1. Verify formula: `(item1_score × attempts1 + item2_score × attempts2) / (attempts1 + attempts2)`
2. Check console output or report
3. **Expected:** Matches manual calculation

### Test 4: Next Session Continuity
1. Complete session → check localStorage for report
2. Start new session
3. **Expected:** Coach briefs Peter on last session's performance matrix
4. **Expected:** Coach focuses on primary_focus from report

### Test 5: Empty Categories
1. Session with only phonetic errors
2. **Expected:** Intonation and stress categories have `weighted_score: 0`, `items: []`

---

## 🚨 ROLLBACK PLAN

If Phase 2 breaks functionality:
```bash
# Keep Phase 1, remove Phase 2:
git revert HEAD~[number_of_phase_2_commits]

# Or full rollback:
git reset --hard [commit_hash_before_phase_2]
```

---

## 📦 DELIVERABLES

- [ ] `src/app/api/analyze-session/route.ts` created and working
- [ ] Analyzer prompt with correct calculation logic
- [ ] `formatCategory` helper in prompt-builder.ts
- [ ] Updated `buildContinuousMode` to use AsyncSessionReport
- [ ] Frontend triggers analysis on session end
- [ ] Next session loads and injects report
- [ ] All formulas verified (item score, weighted category score)
- [ ] Tests passing (see Testing Protocol)

---

## 🔑 KEY FORMULAS (FOR VERIFICATION)

### Item Score
```
score = (sum of all attempt scores) / (number of attempts)
Example: [0, 0, 50, 100, 100] → (0+0+50+100+100)/5 = 50%
```

### Category Weighted Score
```
weighted_score = Σ(item_score × item_attempts) / Σ(item_attempts)
Example:
  /r/: 40% × 5 attempts = 200
  /ɔː/: 80% × 4 attempts = 320
  Category: (200 + 320) / (5 + 4) = 520/9 = 57.8%
```

### Status Thresholds
```
0-40%   → NEEDS_WORK
41-70%  → IMPROVING
71-90%  → GOOD
91-100% → MASTERED
```

---

## 🎯 CONTINUITY PRINCIPLES

1. **Condensed Data:** Prompt receives condensed matrix, not full transcript
2. **Hierarchical Focus:** Phonetics always takes priority over intonation/stress
3. **Explicit Shifts:** Coach must verbalize when moving to secondary focus
4. **Consistency:** Verbal feedback protocol maintained across all sessions
5. **Data Integrity:** Analyzer is source of truth, not live session estimates

---

**Ready for Phase 2?** Ensure Phase 1 tests all pass before proceeding. Good luck! 🧠
