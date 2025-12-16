# Implementation Roadmap - Optimized Priority Order

## Branch Strategy
**New Branch**: `feature/scoring-fixes-and-improvements`

## Chat Strategy
**Continue in this chat** for Phase 1 (quick verification/fixes), then **start new chat** for Phase 2 (major features).

---

## PHASE 1: Critical Fixes (This Chat - Immediate)
**Estimated Time**: 1-2 hours testing
**Goal**: Fix scoring calculation and analyzer prompt issues

### Step 1.1: Fix Overall Score Calculation ⚠️ CRITICAL
**Issue**: Currently averaging **category scores**, should average **all individual attempts**

**Current (WRONG)**:
```
overall = (phonetics_avg + intonation_avg + stress_avg) / 3
```

**Required (CORRECT)**:
```
overall = sum(all_attempt_scores) / count(all_attempts)
```

**Example**:
- Phonetics: /r/ [0,0,50] = 16.7%, /ɔː/ [100,100] = 100%
- Intonation: Wh-Q [50,50] = 50%
- Stress: Photo [0] = 0%

Current wrong calc: `(58.3 + 50 + 0) / 3 = 36.1%`
Correct calc: `(0+0+50+100+100+50+50+0) / 8 = 43.75%`

**Changes**:
- `src/app/api/analyze-session/route.ts`: Update prompt to calculate grand average
- Example formula in prompt

**Test**: Manual calculation vs reported score

---

### Step 1.2: Verify Threshold Removal ✅
**Status**: Already implemented (last commit)
**Action**: Verify analyzer doesn't skip any drills due to attempt count
**Test**: Session with single-attempt drills should all appear in report

---

### Step 1.3: Improve Analyzer Role & Semantic NLP 🔧
**Current Issues**:
- Role described as "pronunciation expert" → confuses semantic task
- Semantic rules may not be clear enough

**Changes**:
a) **Role redefinition**:
```
OLD: "Forensic Linguistics Analyst (British RP)"
NEW: "Statistical NLP Analyst & Text Pattern Recognizer"
```

b) **Remove pronunciation expertise mentions**:
- Focus on counting, pattern matching, sentiment analysis
- Emphasize: "You analyze TEXT, not audio. Focus on feedback semantics."

c) **Enhance semantic examples**:
- Add 10+ varied feedback examples for each category (0%, 50%, 100%)
- Include edge cases: sarcasm, indirect praise, comparative statements

**File**: `src/app/api/analyze-session/route.ts`

**Test**: Review analyzer's attempt counting with varied Alex responses

---

### Step 1.4: Handle 0% Overall Score 🔢
**Issue**: 0% is valid score (all attempts failed), not "no data"

**Logic**:
- `0%` = legitimate score (student failed everything)
- `null` or absence = no session data yet
- UI should display "0%" proudly (motivational: "nowhere to go but up!")

**Changes**:
- Ensure analyzer can output `0` for overall_rp_proficiency
- UI handles 0% as valid score (red background with encouragement message)

**Files**: 
- `src/app/api/analyze-session/route.ts`
- `src/app/page.tsx` (UI handling)

---

## PHASE 2: Major Features (New Chat - After Phase 1 tested)
**Estimated Time**: 4-6 hours
**Goal**: Session continuity and UX enhancements

### Step 2.1: Session Duration Workaround (10min Limit) 🔄 TOP PRIORITY
**Issue**: Gemini Native Audio terminates at ~10 minutes

**Solution**: Auto-chaining sessions
```
Session 1 (10min) → Auto-restart → Session 2 (10min) → User ends → Combined report
```

**Implementation**:
1. **Detection**: Monitor WebSocket close events for max duration signal
2. **Auto-restart**: Immediately call `startSession()` with `continuation=true` flag
3. **Transcript merging**: Append new entries to existing log
4. **Report generation**: Only on final user-triggered stop
5. **Combined analysis**: Single report covering all consecutive sessions

**Technical Details**:
- Add `sessionChainId` to track related sessions
- Modify `useLiveRPCoach.ts`: Add continuation logic
- Update `analyze-session` API: Accept multiple transcript chunks
- localStorage: Track chain status

**Challenges**:
- Avoid duplicate greetings (Alex shouldn't re-introduce)
- Maintain conversation context
- Handle errors during auto-restart

---

### Step 2.2: User Interruption (Voice Activity Detection) 🎤
**Issue**: Alex continues speaking when user talks (volume only decreases)

**Root Cause**: Gemini API doesn't support server-side interruption

**Workaround Options**:

**Option A - Client-side Audio Interruption**:
1. Monitor user audio input level
2. When significant input detected → stop playing Alex's audio buffers
3. Clear queued audio chunks
4. Send interrupt signal to WebSocket

**Option B - Pause-based**:
1. User hits "Pause" button when wants to speak
2. More reliable but requires manual action

**Recommendation**: Implement Option A with fallback to Option B

**Files**: `src/hooks/useLiveRPCoach.ts` (audio playback management)

---

### Step 2.3: Progress Graph UI 📊
**Feature**: Interactive line chart showing overall RP proficiency over time

**Requirements**:
- Time ranges: Last 10 days / Last 50 days / All time
- Touch-responsive (show value on tap/hover)
- Data from localStorage (RP_SESSION_HISTORY)
- Smooth animations
- Mobile-optimized

**Library**: Chart.js or Recharts (already React-friendly)

**Implementation**:
1. Install charting library
2. Create `<ProgressChart />` component
3. Replace "No session data yet" section
4. Add dropdown for time range selection
5. Calculate datapoints from session history

**Files**: 
- `src/app/page.tsx`
- `src/components/ProgressChart.tsx` (new)

---

### Step 2.4: iPhone Lock Screen Mic Muting 📱
**Issue**: Mic mutes when iPhone locks

**Root Cause**: iOS Safari suspends media capture on lock

**Solutions**:

**Option A - Wake Lock** (already implemented):
- Keeps screen on → prevents mic suspension
- ✅ Already in codebase

**Option B - Background Audio Session**:
- Register as audio playback app
- iOS allows background audio
- Requires PWA manifest update

**Option C - User Education**:
- Add banner: "Keep screen unlocked for best experience"
- Provide "Add to Home Screen" instructions

**Recommendation**: Enhance wake lock + add user guidance

---

### Step 2.5: Alex Self-Interruption & Word Errors 🐛
**Issues**:
- Alex repeats himself mid-sentence
- Swaps words incorrectly

**Root Causes**:
1. **Self-interruption**: Gemini API sometimes sends multiple audio chunks in wrong order
2. **Word errors**: Temperature too high (currently 0.6) or context confusion

**Solutions**:
1. **Lower temperature**: 0.6 → 0.4 for more precision
2. **Increase top_p**: Add `top_p: 0.9` to generation config
3. **Audio buffering**: Ensure sequential playback (already using `audioScheduleTimeRef`)
4. **Context clarity**: Improve system prompt to emphasize exact word reproduction

**Files**:
- `src/app/api/session/route.ts` (temperature)
- `src/lib/prompt-builder.ts` (prompt clarity)
- `src/hooks/useLiveRPCoach.ts` (audio scheduling)

---

## PHASE 3: Polish (Future - Optional)
- Enhanced error handling
- Offline mode
- Voice selection UI
- System prompt editor
- Export session data

---

## Handoff Document (For New Chat - Phase 2)

### Context Summary
**Project**: RP Native Coach - Real-time British accent coaching with Gemini 2.5 Flash Native Audio
**Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, WebSocket audio streaming
**Current State**: 
- ✅ Live audio coaching working
- ✅ Async session analysis implemented
- ✅ Mic mute, pause/resume, wake lock added
- ⚠️ Overall score calculation fixed but needs testing
- ⚠️ Session duration limit (10min) requires workaround

### Completed in Previous Chat
1. Phase 1 async analysis implementation
2. Semantic NLP feedback classification
3. Temperature optimization (0.6 native, 0.4 analyzer)
4. Removed min attempt thresholds
5. Overall score changed to simple average of ALL attempts
6. UI controls (mute, pause, wake lock)
7. Exercise ratio guidance (3 phonemes : 1 intonation : 1 stress)

### Priority Tasks for This Chat
**In Order**:
1. **Session Duration Workaround** (highest priority - breaks 10+ min sessions)
2. **User Interruption** (UX critical)
3. **Progress Graph UI** (visual enhancement)
4. **iPhone Lock Screen** (mobile usability)
5. **Alex Self-Interruption** (quality issue)

### Key Files to Review
- `src/hooks/useLiveRPCoach.ts` - WebSocket audio streaming (1000+ lines)
- `src/app/api/analyze-session/route.ts` - Async analyzer with NLP
- `src/app/page.tsx` - Main UI
- `src/types/index.ts` - TypeScript interfaces
- `src/lib/prompt-builder.ts` - Dynamic system prompt

### Known Issues to Address
1. Overall score = category avg (should be grand avg of attempts) ← FIX IN PROGRESS
2. 10-minute session limit needs auto-chaining
3. User voice doesn't interrupt Alex
4. iPhone mutes mic on lock
5. Alex self-interrupts and swaps words

### localStorage Structure
```typescript
RP_INITIAL_BENCHMARK: SessionMetrics
RP_CURRENT_STATUS: SessionMetrics
RP_SESSION_HISTORY: SessionHistory[] // For progress graph
RP_LAST_SESSION_REPORT: AsyncSessionReport
RP_TEMPERATURE: number (0.6 default)
```

### Current Architecture
```
User speaks → AudioContext (16kHz PCM16) → WebSocket → Gemini
Gemini → WebSocket → Base64 PCM16 → AudioContext playback
Session end → Transcript → Analyzer API (text-only Gemini) → Report → localStorage
Next session → Report loaded → Injected into native audio system prompt
```

### Build & Deploy
```bash
npm run build  # Local build
git push origin master  # Auto-deploys to Vercel
```

---

## Questions to Address Before Starting
1. **Manual calculation example**: What session data gave wrong score?
2. **Test environment**: Local dev or production Vercel?
3. **Priority confirmation**: Session duration workaround first?

---

**Recommendation**: Let's fix Phase 1 issues in this chat NOW (30 min), test, then start fresh chat for Phase 2 major features with this handoff.
