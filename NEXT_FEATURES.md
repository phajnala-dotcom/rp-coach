# Next Features - Implementation Guide

## Current State Summary
- **Tech Stack**: Next.js 16.0.10, TypeScript, Tailwind CSS, Gemini 2.5 Flash Native Audio
- **Model**: `gemini-2.5-flash-native-audio-preview-12-2025`
- **Current Voice**: Enceladus (hardcoded)
- **UI Theme**: UK flag design, British colors, 264x264px flag with blurred border
- **Key Files**:
  - `src/app/page.tsx` - Home page with flag and "Begin RP Coaching" button
  - `src/hooks/useLiveRPCoach.ts` - WebSocket audio streaming, metrics parsing
  - `src/lib/prompt-builder.ts` - System prompt builder (has STATIC_ROLE section)
  - `src/app/api/session/route.ts` - API endpoint for session config

## Feature B: Voice Chat Page Design Consistency
**Priority**: Implement FIRST (simpler, builds on current UI work)

### B1. Button Positioning & Sizing
- Move "Mark for report" and "End Session" buttons to same position as "Begin RP Coaching" button on home page
- Apply same height: `py-[19px]` (currently used for session controls)
- Keep horizontal layout (side by side)

### B2. UK Flag on Voice Chat Page
- Copy the UK flag SVG from home page (currently in `src/app/page.tsx`)
- Same position and size: 264x264px with blurred radial gradient border
- Place above the session control buttons (same layout as home page)

### B3. Audio-Reactive Flag Animation
- **Preferred**: Make flag animation respond to audio input/output during voice chat
  - Suggestion: Scale glow intensity based on audio amplitude
  - Use Web Audio API `AnalyserNode` to get frequency data
  - Animate the blurred border or add pulsing effect
- **Fallback**: If too complex, keep the same static animation as home page (rotate, glow)

## Feature A: Settings Page
**Priority**: Implement SECOND (larger scope, requires fresh context)

### A0. Replace Dev Menu with Settings Icon
- Remove/disable current dev menu
- Replace icon with gear/cog icon (⚙️ or use Lucide React `Settings` icon)
- Keep same fixed positioning properties as current dev menu icon

### A1. Voice Selection Dropdown
**Voice Options** (from https://ai.google.dev/gemini-api/docs/speech-generation):
- Puck
- Charon
- Kore
- Fenrir
- Aoede
- Enceladus (current default)

**Implementation**:
- Dropdown menu with voice names only (no adjectives)
- Selected voice name replaces "Steve" in system prompt
- Store selection in localStorage: `RP_VOICE_PREFERENCE`
- Update `buildUserProfileBlock()` in `src/lib/prompt-builder.ts` to use selected voice as `coach_name`

### A2. Model Temperature Slider
- Range: 0 to 2 (step: 0.1)
- Default: 1.0
- Store in localStorage: `RP_TEMPERATURE`
- Pass to API session config in `src/app/api/session/route.ts`
- Add to `generationConfig.temperature` parameter

### A3. System Prompt Editor
- Multiline text box (textarea)
- Prefill with current `STATIC_ROLE` content from `src/lib/prompt-builder.ts` (lines ~145-230)
- Save button:
  - Inactive (grayed) when no changes detected
  - Active when text differs from original
- On save: Store in localStorage: `RP_CUSTOM_PROMPT`
- Modify `buildSystemInstruction()` to check for custom prompt and use it instead of STATIC_ROLE

### A4. Access Control
- Settings icon visible ONLY on home page (with flag)
- NOT visible on voice chat page
- Clicking gear icon navigates to `/settings` route (or modal overlay)

### A5. Auto-Return Behavior
- Clicking outside dropdown menus → return to home page
- Clicking outside textarea → return to home page
- Alternative: ESC key or "Back" button to return

## Technical Notes

### Current Prompt Structure (3 parts):
1. **Part 0**: User Profile Block - uses `profile.coach_name` (currently "Steve")
2. **Part 1**: Meta-Instruction (fixed)
3. **Part 2**: Dynamic Data Block (benchmark vs continuous mode)
4. **Part 3**: Static Role & Methodology (STATIC_ROLE constant)

### Key API Session Parameters (src/app/api/session/route.ts):
```typescript
generationConfig: {
  responseModalities: "audio",
  speechConfig: {
    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Enceladus" } }
  }
  // Add: temperature: <from settings>
}
```

### Storage Keys:
```typescript
STORAGE_KEYS = {
  INITIAL_BENCHMARK: 'RP_INITIAL_BENCHMARK',
  CURRENT_STATUS: 'RP_CURRENT_STATUS',
  SESSION_HISTORY: 'RP_SESSION_HISTORY',
  USER_PROFILE: 'RP_USER_PROFILE',
  // Add these:
  VOICE_PREFERENCE: 'RP_VOICE_PREFERENCE',
  TEMPERATURE: 'RP_TEMPERATURE',
  CUSTOM_PROMPT: 'RP_CUSTOM_PROMPT',
}
```

## Recommended Implementation Order

### Feature B (Same Chat):
1. Create branch: `git checkout -b feature/design-consistency`
2. B2 → Copy UK flag SVG to voice chat page
3. B1 → Reposition and resize buttons
4. B3 → Attempt audio-reactive animation (fallback to static if needed)
5. Test, commit, merge

### Feature A (New Chat):
1. Create branch: `git checkout -b feature/settings-page`
2. A0 → Replace dev menu with gear icon
3. Create `/settings` route and layout
4. A1 → Voice selection dropdown
5. A2 → Temperature slider
6. A3 → Prompt editor
7. A4 & A5 → Access control and auto-return
8. Test all settings persist and apply correctly
9. Commit, merge

## Files to Reference
- Home page UI: `src/app/page.tsx` (lines 150-350 for flag SVG and buttons)
- Voice chat hook: `src/hooks/useLiveRPCoach.ts`
- System prompt: `src/lib/prompt-builder.ts` (STATIC_ROLE starts ~line 145)
- API session: `src/app/api/session/route.ts` (voiceConfig, generationConfig)
- Storage types: `src/types/index.ts`
