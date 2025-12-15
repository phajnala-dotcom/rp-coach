# QUICK START GUIDE - New Chat Session

## For the Agent Starting Fresh

### Context Summary
You're implementing **Phase 1** of the async analysis refactoring for the RP Coach app.

### Branch Information
- **Current branch:** `feature/async-analysis`
- **Base branch:** `master`
- **Already done:** Implementation plans created and committed

### What to Read First
1. **START HERE:** [ASYNC_REFACTORING_README.md](./ASYNC_REFACTORING_README.md) - Overview
2. **YOUR TASK:** [PHASE_1_IMPLEMENTATION_PLAN.md](./PHASE_1_IMPLEMENTATION_PLAN.md) - Detailed steps
3. **LATER:** [PHASE_2_IMPLEMENTATION_PLAN.md](./PHASE_2_IMPLEMENTATION_PLAN.md) - Next phase (separate chat)

### Phase 1 Objectives (This Chat Session)
1. ✅ Remove JSON metrics from live sessions (reduce latency)
2. ✅ Add verbal feedback mandate to prompts
3. ✅ Implement transcript logging (speaker + timestamp + text)
4. ✅ Test: Faster responses, no JSON errors, transcript saves correctly

### Files You'll Modify
- `src/types/index.ts` - Add TranscriptEntry, AnalysisItem, CategoryResult, AsyncSessionReport
- `src/lib/prompt-builder.ts` - Remove JSON mandate, add verbal feedback mandate
- `src/hooks/useLiveRPCoach.ts` - Remove JSON parsing, add transcript logging
- `src/app/page.tsx` - Optional: Add transcript viewer for debugging

### Implementation Order
Follow **PHASE_1_IMPLEMENTATION_PLAN.md** Step 1 → Step 2 → Step 3 → Step 4 → Testing

### Testing Checklist
- [ ] No JSON parsing errors in console
- [ ] Live session feels faster/more responsive
- [ ] Transcript logs accurately capture conversation
- [ ] Verbal feedback is explicit ("Correct", "Incorrect", "Almost")

### Commit After Each Step
```bash
git commit -m "Phase 1: [what you did]"
```

### Environment
- Next.js app with Gemini 2.5 Flash Native Audio
- TypeScript + Tailwind CSS
- WebSocket for real-time audio streaming
- localStorage for persistence

### Key Principle
**Separation of Concerns:** Live session = UX (fast). Analysis = Accuracy (async).

### If You Get Stuck
- Re-read the relevant section in PHASE_1_IMPLEMENTATION_PLAN.md
- Check existing code in src/hooks/useLiveRPCoach.ts for patterns
- Test incrementally - commit working code before moving to next step

### When Phase 1 is Complete
- Run all tests
- Build: `npm run build`
- Push: `git push`
- User will start Phase 2 in a NEW chat session

---

**Good luck! Start with Step 1 in PHASE_1_IMPLEMENTATION_PLAN.md 🚀**
