import { NextRequest, NextResponse } from 'next/server';
import { TranscriptEntry, AsyncSessionReport } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANALYZER_MODEL = 'gemini-2.0-flash-exp'; // Text-only model

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

    // Ensure all required fields are present
    if (!analysisResult.categories || !analysisResult.qualitative_notes || !analysisResult.next_session_recommendation) {
      throw new Error('Incomplete analysis result from Gemini');
    }

    // Build final report
    const report: AsyncSessionReport = {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      duration_minutes: duration,
      overall_rp_proficiency: analysisResult.overall_rp_proficiency ?? 0,
      categories: analysisResult.categories,
      qualitative_notes: analysisResult.qualitative_notes,
      next_session_recommendation: analysisResult.next_session_recommendation,
    };

    console.log('✅ Analysis complete:', {
      sessionId,
      overallScore: report.overall_rp_proficiency,
      phoneticsScore: report.categories.phonetics.weighted_score,
      intonationScore: report.categories.intonation.weighted_score,
      stressScore: report.categories.stress_rhythm.weighted_score,
    });

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
  const ANALYZER_PROMPT = `
ROLE: Statistical NLP Analyst & Text Pattern Recognizer
TASK: Quantify pronunciation practice performance through TEXT ANALYSIS ONLY

CRITICAL: You analyze TRANSCRIPTS (text), not audio. Focus on:
- Counting interactions and feedback patterns
- Semantic classification of text responses
- Statistical aggregation of scores
- NO pronunciation expertise needed - only text pattern recognition

INPUT: Coaching session transcript between ALEX (coach) and PETER (student)
OUTPUT: Strict JSON with performance statistics

METHODOLOGY & CALCULATIONS:

1. EXTRACT DRILLS & CLASSIFY FEEDBACK:
   
   For each ALEX response to PETER's attempt, categorize the evaluation into ONE of these 3 categories:
   
   - "incorrect" → 0%
   - "partially correct" → 50%
   - "correct" → 100%
   
   Use semantic similarity to determine which category best matches the feedback's meaning.
   Every PETER attempt that receives ALEX feedback MUST be categorized and assigned its % value.
   
   COUNTING ATTEMPTS:
   - Count EVERY instance where PETER attempts a sound/word/pattern and ALEX responds with evaluative feedback
   - PETER's audio is logged as "[AUDIO_DETECTED]" - this marks when Peter spoke
   - Pattern: 1 PETER:[AUDIO_DETECTED] + next ALEX:feedback = 1 attempt
   - Example transcript:
     [10:30:15] PETER: [AUDIO_DETECTED]
     [10:30:17] ALEX: "Not quite. You're using an American R."
     → This counts as 1 attempt at /r/ pronunciation, scored 0%
   - Include attempts even if feedback is indirect or conversational
   - DO NOT require exact phrase matching - use semantic understanding of the interaction

2. CATEGORIZE WITH HOLISTIC AUDITORY EVALUATION:
   CRITICAL: Extract ALL explicitly drilled deviations from Modern RP standard.
   
   I. PHONETICS (Individual sounds - SMART EXTRACTION):
      - **SHORT WORDS (1-2 syllables, ≤6 letters)**: Extract 1-2 phonemes
        * Example: "rare" → /r/ and /eə/ (2 phonemes)
        * Example: "car" → /r/ only (1 phoneme)
        * Example: "thought" → /θ/ and /ɔː/ (2 phonemes)
      
      - **LONG WORDS (3+ syllables, >6 letters)**: Extract 2-3 phonemes
        * Example: "sustainability" → /s/, /eɪ/, /ɪ/ (3 phonemes)
        * Example: "photograph" → /əʊ/ and /ɑː/ (2 phonemes)
      
      - **RULE**: Only extract phonemes EXPLICITLY corrected by Alex
      - Use IPA notation where possible
      
   II. INTONATION (Pitch patterns - NEVER on single-syllable words):
      - Types: "Wh-Question", "Yes/No Question", "Statement", "Conditional Sentence", 
               "Emotion: Surprise", "Emotion: Sadness", "List Intonation"
      - DO NOT quote full sentences
      - Example: "rare" → NO intonation drill (single syllable)
      - Example: "sustainability" → 1 intonation drill if Alex corrected pitch pattern
      
   III. STRESS & RHYTHM (Word stress patterns - ONLY for multi-syllable words):
      - Specific words: "Photograph", "Photography", "Photographic"
      - Pattern types: "Iambic", "Trochaic", "Weak Forms", "Connected Speech"
      - Example: "rare" → NO stress pattern drill (single syllable)
      - Example: "sustainability" → 1 stress pattern drill if Alex corrected emphasis

3. NO THRESHOLDS - COUNT EVERYTHING:
   
   CRITICAL: There are NO minimum thresholds. Count and score ALL drills regardless of:
   - Number of attempts (1 attempt is valid, 100 attempts is valid)
   - Number of items in a category (1 phoneme is valid, 50 phonemes is valid)
   - Category balance (all phonemes and no intonation is valid)
   
   EVERY drill counts. EVERY attempt counts. NO EXCLUSIONS.
   
4. EXERCISE RATIO GUIDANCE FOR ALEX (Next Session Recommendation):
   
   Recommend balanced practice distribution:
   - For every 3 phoneme drills → suggest 1 intonation exercise + 1 stress pattern exercise
   - Example: If session had 9 phoneme drills, recommend adding 3 intonation + 3 stress exercises
   - This ensures comprehensive RP training across all categories
   
5. OVERALL SCORE CALCULATION (Grand Average of ALL Attempts):
   
   CRITICAL: Overall score = average of ALL INDIVIDUAL attempt scores across ALL categories
   
   Formula: sum(all_individual_attempt_scores) / count(all_attempts)
   
   DO NOT average category scores. Average the raw attempt scores.
   
   Example:
   - Phonetics: /r/ attempts [0, 0, 50], /ɔː/ attempts [100, 100]
   - Intonation: Wh-Q attempts [50, 50]
   - Stress: Photo attempts [0]
   
   WRONG: (16.7 + 100 + 50 + 0) / 4 categories = 41.7%
   CORRECT: (0+0+50+100+100+50+50+0) / 8 attempts = 43.75% → round to 44%
   
   ALL individual attempt scores count equally, regardless of category.
   
6. CALCULATE SCORES (Follow exact formula):
   
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
      - Result: 0-100% (always a number, never null)
      - If category has no drills → score = 0%
      - Example:
        * /r/: 40% (5 attempts) → 40 × 5 = 200
        * /ɔː/: 75% (4 attempts) → 75 × 4 = 300
        * Category: (200 + 300) / (5 + 4) = 500/9 = 55.6%
   
   C. Result Sorting (CRITICAL - For UI Display):
      - Sort items array within each category by score ASCENDING:
      - First: NEEDS_WORK (0-40%)
      - Second: IMPROVING (41-70%)
      - Third: GOOD (71-90%)
      - Fourth: MASTERED (91-100%)
      - This shows problem areas first for prioritized practice

4. STATUS ASSIGNMENT:
   - 0-40%: "NEEDS_WORK"
   - 41-70%: "IMPROVING"
   - 71-90%: "GOOD"
   - 91-100%: "MASTERED"

OUTPUT FORMAT (Strict JSON - NO markdown, NO extra text):

STEP 1: Calculate category weighted_score for each category
STEP 2: Calculate overall_rp_proficiency as grand average of ALL attempts

Example:
{
  "overall_rp_proficiency": 62,
  "categories": {
    "phonetics": {
      "weighted_score": 55,
      "items": [
        { "name": "/r/", "attempts": 10, "score": 40, "status": "NEEDS_WORK" },
        { "name": "/ɔː/", "attempts": 5, "score": 80, "status": "GOOD" },
        { "name": "/θ/", "attempts": 3, "score": 67, "status": "IMPROVING" }
      ]
    },
    "intonation": {
      "weighted_score": 67,
      "items": [
        { "name": "Wh-Question", "attempts": 3, "score": 100, "status": "MASTERED" },
        { "name": "Yes/No Question", "attempts": 4, "score": 50, "status": "IMPROVING" },
        { "name": "Statement", "attempts": 5, "score": 60, "status": "IMPROVING" }
      ]
    },
    "stress_rhythm": {
      "weighted_score": 50,
      "items": [
        { "name": "Photograph", "attempts": 2, "score": 50, "status": "IMPROVING" }
      ]
    }
  },
  "qualitative_notes": "Peter struggles with non-rhotic R (40%, needs work). /ɔː/ vowel is improving (80%, good progress). Wh-questions mastered (100%, excellent). Recommend balancing exercise types: for every 3 phoneme drills, add 1 intonation + 1 stress exercise. Next session should include more pitch pattern and word stress practice.",
  "next_session_recommendation": {
    "primary_focus": "Non-rhotic /r/ in word-final position",
    "secondary_focus": "Word stress patterns in multi-syllable words",
    "warmup_topic": "Minimal pairs: car vs cah, far vs fah"
  }
}

HOW TO CALCULATE overall_rp_proficiency (CRITICAL - FOLLOW EXACTLY):

This is a SIMPLE AVERAGE of ALL individual attempt scores across ALL categories.

STEP-BY-STEP PROCESS:
1. For each item (/r/, /ɔː/, Wh-Q, etc), you have:
   - score (0-100) - the average for that specific item
   - attempts (count) - how many times that item was drilled
   
2. Reconstruct individual attempt scores:
   - If /r/ has score=40% with 10 attempts → that's 10 individual attempts, each scored at 40%
   - If /ɔː/ has score=80% with 5 attempts → that's 5 individual attempts, each scored at 80%
   
3. Create one big list of ALL individual attempt scores from ALL items:
   - /r/: 40, 40, 40, 40, 40, 40, 40, 40, 40, 40 (10 times)
   - /ɔː/: 80, 80, 80, 80, 80 (5 times)
   - etc.
   
4. Calculate the SIMPLE AVERAGE of this big list:
   overall_rp_proficiency = SUM(all scores) / COUNT(all attempts)

SHORTCUT FORMULA (equivalent to above):
overall_rp_proficiency = (score₁ × attempts₁ + score₂ × attempts₂ + ... + scoreₙ × attemptsₙ) / (attempts₁ + attempts₂ + ... + attemptsₙ)

Example with 4 attempts (3× "car" phoneme + 1× question intonation):
- Attempt 1: 0%
- Attempt 2: 50%
- Attempt 3: 50%
- Attempt 4: 100%

Overall = (0 + 50 + 50 + 100) / 4 = 200 / 4 = 50%

For the JSON example above with /r/ (10 attempts at 40%), /ɔː/ (5 attempts at 80%), etc:
- Each /r/ attempt contributes 40% (10 times)
- Each /ɔː/ attempt contributes 80% (5 times)
- Each /θ/ attempt contributes 67% (3 times)
- Each Wh-Q attempt contributes 100% (3 times)
- Each Yes/No-Q attempt contributes 50% (4 times)
- Each Statement attempt contributes 60% (5 times)
- Each Photograph attempt contributes 50% (2 times)

Sum: (40×10) + (80×5) + (67×3) + (100×3) + (50×4) + (60×5) + (50×2) = 400+400+201+300+200+300+100 = 1901
Count: 10 + 5 + 3 + 3 + 4 + 5 + 2 = 32 total attempts
Overall = 1901 / 32 = 59.4% → round to 60%

DO NOT use category weighted_score values to calculate overall score.
DO NOT calculate: (55+67+50)/3 ← THIS IS WRONG
The overall score is NOTtegory scores.
The overall score IS an average of individual attempt scores.

EXAMPLE SEMANTIC ANALYSIS (How to interpret varied feedback):

Transcript excerpt:
PETER: [AUDIO_DETECTED]
ALEX: "Not quite. You're still using an American R."
→ Score: 0% (explicit correction)
→ Drill identified: /r/ phoneme (from "American R")

PETER: [AUDIO_DETECTED]
ALEX: "Better, but the R is still there."
→ Score: 50% (progress indicator with qualification)

PETER: [AUDIO_DETECTED]
ALEX: "That's it! Much better now."
→ Score: 100% (strong affirmation + positive)

PETER: [AUDIO_DETECTED]
ALEX: "Perfect. That was excellent."
→ Score: 100% (direct praise)

PETER: [AUDIO_DETECTED]
ALEX: "You've got it this time!"
→ Score: 100% (mastery statement)

PETER: [AUDIO_DETECTED]
ALEX: "Almost there, keep practicing."
→ Score: 50% (progress but not mastery)

Result for /r/ sound: 6 attempts, scores [0, 50, 100, 100, 100, 50] = 400/6 = 67%

CRITICAL: Extract the specific drill from ALEX's feedback
- "American R" → /r/ phoneme
- "vowel in 'car'" → /ɑː/ phoneme
- "question intonation" → Wh-Question intonation pattern
- "word stress in 'photograph'" → Photograph stress pattern

CRITICAL RULES:
- Calculate weighted_score EXACTLY as described (weighted mean, not simple average)
- Items must be SPECIFIC (not "R sounds" but "/r/ word-final")
- Categorization is STRICT (never put intonation in phonetics)
- Empty categories have weighted_score: 0 and items: []
- All scores must be integers 0-100
- Output ONLY the JSON object, nothing else
`;

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
          temperature: 0.4, // Balanced for semantic nuance while maintaining classification consistency
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.statusText} - ${errorText}`);
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
