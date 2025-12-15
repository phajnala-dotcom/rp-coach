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
      overall_rp_proficiency: analysisResult.overall_rp_proficiency ?? null,
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
ROLE: Forensic Linguistics Analyst (British RP) with NLP Capabilities
INPUT: Coaching session transcript between ALEX (coach) and PETER (student)
TASK: Quantify PETER's pronunciation performance using NATURAL LANGUAGE PROCESSING to semantically analyze ALEX's varied feedback

CRITICAL: Use NLP semantic understanding, NOT exact string matching. Alex's feedback is natural, conversational, and varied.

METHODOLOGY & CALCULATIONS:

1. EXTRACT DRILLS:
   - Scan for utterances where ALEX corrects PETER
   - Use SEMANTIC UNDERSTANDING to classify feedback (NOT exact string matching)
   
   SEMANTIC CLASSIFICATION RULES:
   
   A. INCORRECT (0%) - Negative feedback or explicit correction:
      - Direct negatives: "No", "Incorrect", "Not yet", "Wrong", "Not quite"
      - Corrections given: "Try again", "Let me hear it again", "That's not right"
      - Explicit errors pointed out: "You're using American R", "Too much tension"
      - Comparative negatives: "Still not there", "That's worse"
   
   B. PARTIALLY CORRECT (50%) - Mixed feedback or incremental progress:
      - Progress indicators: "Better", "Getting there", "Closer", "Improving", "Almost"
      - Qualified praise: "That's better than before", "Much improved", "Nearly perfect"
      - Conditional approval: "Better, but...", "Good, however...", "On the right track"
      - Partial success: "The first part was good", "Better on that sound"
   
   C. CORRECT (100%) - Positive affirmation or mastery confirmation:
      - Direct praise: "Perfect", "Excellent", "Spot on", "That's right", "Correct"
      - Strong affirmations: "Well done", "Brilliant", "Exactly", "Yes", "Good"
      - Mastery statements: "You've got it", "That's it", "Nailed it", "Beautiful"
      - Encouraging continuation: "Keep going", "Do that again", "Exactly like that"
      - Natural variations: "That was perfect", "It was correct this time", "Much better now"
   
   CRITICAL: Focus on INTENT and SENTIMENT, not exact phrases. Alex's feedback is natural and varied.
   
   COUNTING ATTEMPTS:
   - Count EVERY instance where PETER attempts a sound/word/pattern and ALEX responds with feedback
   - Include attempts even if feedback is indirect or conversational
   - Example: If PETER says "car" 6 times and ALEX responds each time, that's 6 attempts
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

3. DATA QUALITY THRESHOLDS (CRITICAL - ENFORCE STRICTLY):
   
   A. MINIMUM ATTEMPTS PER PRACTICE ITEM:
      - Each practice item (phoneme/intonation/stress) MUST have ≥3 attempts
      - If <3 attempts → EXCLUDE from category calculation
      - Mark as "INSUFFICIENT_DATA" in notes
   
   B. MINIMUM PRACTICE ITEMS PER CATEGORY:
      - Each category MUST have ≥3 valid practice items (with ≥3 attempts each)
      - If <3 valid practice items → Set category weighted_score = null
      - Mark category as "INSUFFICIENT_DATA" in notes
   
   C. OVERALL SCORE CALCULATION:
      - Requires ALL 3 categories to have valid weighted_score (not null)
      - If ANY category is null → Set overall_rp_proficiency = null
      - Formula: (phonetics × 0.60) + (intonation × 0.20) + (stress_rhythm × 0.20)
      - Weights: 60% Phonetics, 20% Intonation, 20% Stress & Rhythm

4. CALCULATE SCORES (Follow exact formula):
   
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
      - Result: 0-100% OR null if <3 valid practice items
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
      "weighted_score": null,
      "items": [
        { "name": "Photograph", "attempts": 2, "score": 50, "status": "INSUFFICIENT_DATA" }
      ]
    }
  },
  "qualitative_notes": "Peter struggles with non-rhotic R (40%). /ɔː/ vowel is improving (80%). Wh-questions mastered. Stress & rhythm category needs more practice (<3 different drills completed). Overall score not calculated due to limited stress_rhythm practice.",
  "next_session_recommendation": {
    "primary_focus": "Non-rhotic /r/ in word-final position",
    "secondary_focus": "Word stress patterns in multi-syllable words",
    "warmup_topic": "Minimal pairs: car vs cah, far vs fah"
  }
}

NOTE: In the example above, overall_rp_proficiency would be null (not 62) because stress_rhythm has insufficient data.

EXAMPLE SEMANTIC ANALYSIS (How to interpret varied feedback):

Transcript excerpt:
PETER: "car"
ALEX: "Not quite. You're still using an American R."
→ Score: 0% (explicit correction)

PETER: "car"
ALEX: "Better, but the R is still there."
→ Score: 50% (progress indicator with qualification)

PETER: "car"
ALEX: "That's it! Much better now."
→ Score: 100% (strong affirmation + positive)

PETER: "car"
ALEX: "Perfect. That was excellent."
→ Score: 100% (direct praise)

PETER: "car"
ALEX: "You've got it this time!"
→ Score: 100% (mastery statement)

PETER: "car"
ALEX: "Almost there, keep practicing."
→ Score: 50% (progress but not mastery)

Result for /r/ sound: 6 attempts, scores [0, 50, 100, 100, 100, 50] = 400/6 = 67%

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
