import { NextRequest, NextResponse } from 'next/server';
import { buildSystemInstruction, generateSessionId } from '@/lib/prompt-builder';
import { SessionMetrics, AsyncSessionReport, DEFAULT_USER_PROFILE, STORAGE_KEYS } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { metrics, lastReport, userProfile, temperature, voiceName } = body;

    // Prefer AsyncSessionReport over legacy SessionMetrics
    const reportOrMetrics = lastReport || metrics || null;

    // Build system instruction
    const systemInstruction = buildSystemInstruction(
      reportOrMetrics as AsyncSessionReport | SessionMetrics | null,
      userProfile || DEFAULT_USER_PROFILE
    );

    // Generate session ID if not provided
    const sessionId = lastReport?.session_id || metrics?.session_id || generateSessionId();

    // Return configuration for client
    return NextResponse.json({
      success: true,
      sessionId,
      systemInstruction,
      config: {
        model: MODEL,
        apiKey: GEMINI_API_KEY,
        temperature: temperature ?? 0.6,
        voiceName: voiceName || 'Enceladus',
      },
    });
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
