// ============================================================================
// TYPE DEFINITIONS - RP Native Coach
// ============================================================================

export interface SessionMetrics {
  session_id: string;           // Unique session identifier
  timestamp: string;             // ISO timestamp
  rp_level: string;              // e.g., "B2"
  previous_focus: string;        // e.g., "/ɔː/ vowel"
  mastery_confirmed: boolean;    // true if user mastered previous_focus
  current_accuracy: number;      // 0-100
  confidence_score: number;      // 0-100: Gemini's confidence in assessment
  residual_error: string;        // e.g., "American /r/ at end of words"
  prosody_gaps: string;          // e.g., "Flat intonation"
  pitch_variance: string;        // e.g., "2.1 Semitones"
  next_primary_focus: string;    // The specific drill for next session
  next_secondary_focus: string;  // Backup focus if primary is mastered
  session_notes: string;         // Brief summary of achievements/issues
}

export interface SessionHistory {
  session_id: string;
  date: string;
  duration_minutes: number;
  metrics: SessionMetrics;
  achievements: string[];        // List of mastered elements
}

export interface UserProfile {
  name: string;
  coach_name: string;
}

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
  weighted_score: number | null;  // 0-100% or null if insufficient samples
  items: AnalysisItem[];
}

// Async session report (for Phase 2)
export interface AsyncSessionReport {
  session_id: string;
  timestamp: string;
  duration_minutes: number;
  overall_rp_proficiency: number | null; // 0-100% weighted score, null if insufficient data
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

export interface MetricsUpdate {
  metrics_update?: SessionMetrics;
  trigger_event?: 'NONE' | 'SHIFT_FOCUS' | 'BENCHMARK_COMPLETE' | 'SESSION_END';
  message?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  error?: string;
  lastConnected?: Date;
}

// Storage Keys
export const STORAGE_KEYS = {
  INITIAL_BENCHMARK: 'RP_INITIAL_BENCHMARK',
  CURRENT_STATUS: 'RP_CURRENT_STATUS',
  SESSION_HISTORY: 'RP_SESSION_HISTORY',
  USER_PROFILE: 'RP_USER_PROFILE',
  VOICE_PREFERENCE: 'RP_VOICE_PREFERENCE',
  TEMPERATURE: 'RP_TEMPERATURE',
  CUSTOM_PROMPT: 'RP_CUSTOM_PROMPT',
  TRANSCRIPT_LOG: 'RP_TRANSCRIPT_LOG',           // New: Session transcript
  LAST_SESSION_REPORT: 'RP_LAST_SESSION_REPORT', // New: For Phase 2
} as const;

// Voice Options (30 voices from Gemini API, alphabetically sorted)
export const VOICE_OPTIONS = [
  'Achernar',
  'Achird',
  'Algenib',
  'Algieba',
  'Alnilam',
  'Aoede',
  'Autonoe',
  'Callirrhoe',
  'Charon',
  'Despina',
  'Enceladus',
  'Erinome',
  'Fenrir',
  'Gacrux',
  'Iapetus',
  'Kore',
  'Laomedeia',
  'Leda',
  'Orus',
  'Pulcherrima',
  'Puck',
  'Rasalgethi',
  'Sadachbia',
  'Sadaltager',
  'Schedar',
  'Sulafat',
  'Umbriel',
  'Vindemiatrix',
  'Zephyr',
  'Zubenelgenubi',
] as const;

export type VoiceName = typeof VOICE_OPTIONS[number];

// Default User Profile
export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Peter',
  coach_name: 'Alex',
};
