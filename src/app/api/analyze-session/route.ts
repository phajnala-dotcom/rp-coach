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
