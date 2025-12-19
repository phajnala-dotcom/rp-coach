# GenAm Refactoring - Implementation Brief

**Branch**: `feature/genam-refactor-diagnostic-flow`  
**Date**: December 19, 2025  
**Priority**: Complete Phase 1, then Phase 2

---

## 🎯 PHASE 1: Core Logic Migration (High Priority)

### 1. GLOBAL ACCENT MIGRATION: RP → GenAm

**What**: Replace all "Modern RP", "RP", "British" references with "General American", "GenAm", "American"

**Files**: `src/lib/prompt-builder.ts`, `src/app/page.tsx`, `src/app/report/page.tsx`, `src/types/index.ts`, `README.md`

**Critical**: Preserve ALL pedagogical logic. Only change accent target, not teaching methods.

**Phonetic Updates**:
- `/ɑː/` → `/æ/` (bath vowel)
- `/ɒ/` → `/ɑ/` (lot vowel) 
- "non-rhotic /r/" → "rhotic /r/"
- Update example words to GenAm standards

**Visual Update**:
- Replace UK flag (🇬🇧) with US flag (🇺🇸)
- Maintain audio animation functionality (pulsing/breathing effect)
- Update in voice orb component or wherever flag appears

---

### 2. DELETE ASYNC ANALYSIS

**Why**: Native Audio model outputs JSON directly in text channel. Async LLM analysis no longer needed.

**Delete**:
- `src/app/api/analyze-session/route.ts` - entire file
- `generateSessionReport()` function from `useLiveRPCoach.ts`
- All `isGeneratingReport` state/logic

**Keep**:
- `src/app/report/page.tsx` - refactor to display native model's JSON
- `STORAGE_KEYS.LAST_SESSION_REPORT` - stores native model JSON

**Rename**: `RP_LAST_SESSION_REPORT` → `GENAM_LAST_SESSION_REPORT`

---

### 3. NEW DIAGNOSTIC SYSTEM PROMPT

**File**: `src/lib/prompt-builder.ts`

**Add to Prompt**:
```
[DIAGNOSTIC PROTOCOL - GENERAL AMERICAN]
- First 3 minutes: Natural conversation to extract phonetic data
- Evaluate: vowels, consonants, intonation, stress, fluency
- At 3:00 mark (on "DIAGNOSTIC_COMPLETE" signal): Output JSON via text channel
- JSON format: {diagnostic_complete, overall_proficiency_score, phonetics_score, intonation_score, stress_score, qualitative_evaluation, focus_phonemes, exercise_types, priority_areas}
- After JSON: Verbalize 1-2 sentence summary (not the full JSON)
- Then: Start exercise loop (2 phonemes → 1 intonation → 1 stress → repeat)
- Use words from user's conversation in drills
- If conversation too short, ask user to continue talking
- Only evaluate conversation (not exercise portion)
```

**Integration**: Add to both `buildBenchmarkMode()` and `buildContinuousMode()`

---

### 4. 3-MINUTE DIAGNOSTIC TIMER

**File**: `useLiveRPCoach.ts`

**Add States**:
- `diagnosticTimeRemaining` (180 seconds)
- `diagnosticComplete` (boolean)

**Countdown Timer**: 
- Decrements every second while session active
- At 0: Send `DIAGNOSTIC_COMPLETE` signal to model via WebSocket
- Set `diagnosticComplete = true`

**UI Display** (`page.tsx`):
- Show timer during first 3 minutes: "⏱️ Diagnostic: 3:00"
- Hide after diagnostic complete

---

### 5. JSON PARSING & REAL-TIME SCORE UPDATES

**File**: `useLiveRPCoach.ts`

**Add State**: 
```typescript
currentScores: {overall, phonetics, intonation, stress}
```

**In `handleWebSocketMessage`**:
- Check text for JSON pattern: `/"diagnostic_complete"\s*:\s*true/`
- Parse JSON, extract scores
- Update `currentScores` state immediately
- Save to localStorage (`LAST_SESSION_REPORT`)
- Play notification sound/animation
- Do NOT add JSON to transcript (it's metadata, not conversation)

**Notification**: Use Web Audio API for simple beep/chime

---

### 6. UI SCORE BANNERS

**During Session** (`page.tsx`):
- After `diagnosticComplete`, show banner with scores
- Display: Overall %, Phonetics %, Intonation %, Stress %
- Green gradient background, fade-in animation

**Home Page**:
- Update existing "Last Session" banner
- Change "RP Proficiency" → "GenAm Proficiency"
- Load from localStorage `LAST_SESSION_REPORT`

---

### 7. iOS BACKGROUND SUPPORT (Lock Screen)

**Problem**: iPhone suspends WebSocket when screen locks

**Solution** (`useLiveRPCoach.ts`):
- Wake Lock API: Keep screen on if supported
- Audio Keep-Alive: Create silent oscillator node (1Hz, 0 volume) that runs continuously
- This tricks iOS into keeping audio context active
- Add iOS PWA meta tags to `layout.tsx`:
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style`

**Manifest** (`public/manifest.json`): Set app name to "GenAm Coach"

---

## 📊 PHASE 2: Progress Graph (After Phase 1 Verified)

### 1. INSTALL LIBRARY
```bash
npm install recharts
```

### 2. CREATE COMPONENT

**File**: `src/components/ProgressChart.tsx`

**Features**:
- Line chart showing proficiency over time
- 2 dropdowns: Time range (10/100 days, all) + Metric (overall/phonetics/intonation/stress)
- Interactive tooltip on touch/hover
- Empty state when no data

**Data Source**: localStorage `GENAM_PROFICIENCY_HISTORY` (array of `{date, overall, phonetics, intonation, stress}`)

### 3. HOME PAGE INTEGRATION

**File**: `src/app/page.tsx`

**Remove**: Everything between "Last Session Proficiency" section and footer

**Insert**: `<ProgressChart />` component in that space

### 4. DATA STORAGE

**New Key** (`types/index.ts`): `PROFICIENCY_HISTORY: 'GENAM_PROFICIENCY_HISTORY'`

**Save Function**: When diagnostic JSON received, append to history array in localStorage

---

## ✅ TESTING CHECKLIST

**Phase 1**:
- [ ] All RP → GenAm text replaced
- [ ] Async analysis deleted, no errors
- [ ] 3-min timer counts down
- [ ] Model outputs JSON at 3:00
- [ ] Scores update immediately on UI
- [ ] Notification plays
- [ ] Exercise loop: 2 phonemes → 1 intonation → 1 stress
- [ ] iPhone session continues with locked screen

**Phase 2**:
- [ ] Graph renders with correct data
- [ ] Dropdowns filter correctly
- [ ] Touch shows values
- [ ] Data persists across sessions

---

## 📝 FOR IMPLEMENTATION CHAT

**Start with**:
1. Confirm branch: `feature/genam-refactor-diagnostic-flow`
2. Begin Phase 1, Step 1 (Global Migration)
3. Test after each major step
4. Only proceed to Phase 2 after Phase 1 fully working

**Key Decisions Made**:
- Native audio JSON replaces async analysis
- 3-minute diagnostic, then exercises
- Exercise loop: 2-1-1 ratio (phonemes-intonation-stress)
- iOS background via silent audio oscillator
- Progress graph uses recharts library
