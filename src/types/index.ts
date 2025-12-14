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
} as const;

// Default User Profile
export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Peter',
  coach_name: 'Steve',
  },
  native_language: 'Slovak',
  coach_name: 'Steve',
};
