'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { STORAGE_KEYS, VOICE_OPTIONS, VoiceName } from '@/types';

const DEFAULT_STATIC_ROLE = `
[STATIC ROLE & CORE METHODOLOGY]
You must speak in a clean, precise, highly distinctive Modern RP at all times. No other accent is allowed, and you must never drift toward default pronunciation or mirror the user. You are a world-class Modern RP coach and prosody trainer. Your methods follow leading authorities in English phonetics (Wells, Roach, Catford, Crystal) and the most accurate contemporary RP descriptions. Your sole task is to transform the user's pronunciation into native-like Modern RP as fast and as reliably as possible.

CORE TRAINING LOOP:
You work in a strict loop: listen → analyse → diagnose → correct → drill → confirm mastery.

1. **ANALYSE** the user's pronunciation in real time with maximum precision.
2. **COMPARE** it directly to Modern RP standards.
3. **DETECT** every deviation, even subtle or inconsistent ones.
4. **MODEL** Give clear vocal demonstrations and strong articulatory instructions.
5. **PERSIST** Do not advance until the user reaches an acceptable RP target (unless explicitly told otherwise).
6. **CRITIQUE** Give direct, honest, objective, highly critical feedback; never overlook errors.
7. **PROGRESS** When a sound is perfect in a word, train it next in short sentences.
8. **CONSOLIDATE** Even after perfection, make the user repeat several times with small variations to build consistency.
9. **PROSODY FOCUS** Maintain strong focus on accurate syllable stress, word stress, rhythm, prosody, intonation, and overall fluency.

TEACHING PRINCIPLES:
- **Exaggerate for clarity:** Over-pronounce target sounds initially
- **Minimal pairs:** Use contrasting words to highlight differences (e.g., "thought" vs "taught")
- **Articulatory precision:** Describe exact tongue/lip positions
- **Immediate correction:** Never let errors pass without comment
- **Incremental difficulty:** Start with isolated sounds → words → phrases → sentences
- **Natural context:** Embed drills in realistic scenarios relevant to Peter's life

[MANDATE: METRICS REPORTING]
You are operating in a Gemini 2.5 Flash Native Audio Multimodal Live session.

CRITICAL REQUIREMENT:
After EVERY spoken response, you MUST emit a concise, machine-readable JSON object via the TEXT channel.

FORMAT (send as text, NOT spoken):
{
  "metrics_update": {
    "session_id": "<same as current session>",
    "timestamp": "<ISO timestamp>",
    "rp_level": "B2",
    "previous_focus": "/ɔː/ vowel",
    "mastery_confirmed": false,
    "current_accuracy": 72,
    "confidence_score": 85,
    "residual_error": "Occasional shortening to /ɒ/",
    "prosody_gaps": "Flat intonation on questions",
    "pitch_variance": "1.8 Semitones",
    "next_primary_focus": "/ɔː/ in connected speech",
    "next_secondary_focus": "Question intonation patterns",
    "session_notes": "Good progress on isolated /ɔː/, needs sentence-level practice"
  },
  "trigger_event": "NONE"
}

TRIGGER EVENTS:
- "NONE": Normal progress update
- "SHIFT_FOCUS": User achieved 85%+ accuracy, shifted to secondary focus
- "BENCHMARK_COMPLETE": Initial diagnostic complete (first session only)
- "SESSION_END": User explicitly ends session

UPDATE FREQUENCY:
- Minimum: Every 5 spoken exchanges
- After any drill sequence
- When shifting focus
- When user requests progress check

DO NOT read this JSON out loud. Send it as text only via the text channel.

ACCURACY CALCULATION GUIDANCE:
Track accuracy internally by counting:
- Total utterances containing target sound/pattern
- Utterances where target was produced correctly
- Accuracy = (correct / total) × 100
- Confidence = Your certainty in the assessment (consider consistency, clarity, context)

When in doubt, be conservative with accuracy scores. It's better to under-estimate than over-estimate.
`;

const SettingsIcon = () => (
  <svg 
    className="w-6 h-6" 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24" 
    strokeWidth={2}
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
    />
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
    />
  </svg>
);

export default function Settings() {
  const router = useRouter();
  const [voice, setVoice] = useState<VoiceName>('Enceladus');
  const [temperature, setTemperature] = useState<number>(1.0);
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_STATIC_ROLE);
  const [originalPrompt, setOriginalPrompt] = useState<string>(DEFAULT_STATIC_ROLE);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem(STORAGE_KEYS.VOICE_PREFERENCE) as VoiceName;
      const savedTemp = localStorage.getItem(STORAGE_KEYS.TEMPERATURE);
      const savedPrompt = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPT);

      if (savedVoice && VOICE_OPTIONS.includes(savedVoice)) {
        setVoice(savedVoice);
      }
      if (savedTemp) {
        setTemperature(parseFloat(savedTemp));
      }
      if (savedPrompt) {
        setCustomPrompt(savedPrompt);
        setOriginalPrompt(savedPrompt);
      }
    }
  }, []);

  useEffect(() => {
    setHasChanges(customPrompt !== originalPrompt);
  }, [customPrompt, originalPrompt]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [router]);

  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTemperature(value);
    localStorage.setItem(STORAGE_KEYS.TEMPERATURE, value.toString());
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          router.push('/');
        }
      }}
    >
      <div className="bg-gradient-to-br from-gray-900/80 via-slate-900/80 to-gray-900/80 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 lg:p-12 w-full max-w-2xl shadow-2xl border border-gray-800/50 max-h-[95vh] overflow-y-auto">
        {/* Header with Settings Icon */}
        <div className="flex items-center justify-between mb-8 sm:mb-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-lg sm:rounded-xl text-white">
              <SettingsIcon />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white transition-colors text-xl sm:text-2xl font-bold leading-none p-2 sm:p-3 hover:bg-gray-800/50 rounded-lg sm:rounded-xl"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Voice Selection - Native Select */}
        <div className="mb-8 sm:mb-10">
          <label htmlFor="voice-select" className="block text-base sm:text-lg font-bold mb-3 text-white">
            Voice Options
          </label>
          <select
            id="voice-select"
            value={voice}
            onChange={(e) => {
              const selectedVoice = e.target.value as VoiceName;
              setVoice(selectedVoice);
              localStorage.setItem(STORAGE_KEYS.VOICE_PREFERENCE, selectedVoice);
            }}
            className="w-full cursor-pointer rounded-xl bg-gray-800/90 hover:bg-gray-800 backdrop-blur-lg transition py-3 sm:py-3.5 px-4 text-base shadow-lg border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {VOICE_OPTIONS.map((voiceOption) => (
              <option key={voiceOption} value={voiceOption} className="bg-gray-800 text-white">
                {voiceOption}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature Slider */}
        <div className="mb-8 sm:mb-10">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <label htmlFor="temperature-slider" className="text-base sm:text-lg font-bold text-white">
              Temperature Setting
            </label>
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent tabular-nums">
              {temperature.toFixed(1)}
            </span>
          </div>
          <div className="relative">
            <input
              id="temperature-slider"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={handleTemperatureChange}
              className="w-full h-2.5 bg-gray-700/80 rounded-full appearance-none cursor-pointer slider-thumb border border-gray-700/50"
            />
            <div 
              className="absolute top-0 left-0 h-2.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full pointer-events-none"
              style={{ width: `${(temperature / 2) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-gray-400 font-medium text-xs sm:text-sm">
            <span>0.0 (Precise)</span>
            <span>2.0 (Creative)</span>
          </div>
        </div>

        {/* System Prompt Editor */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-bold mb-3 text-white">
            System Prompt Editor
          </h2>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full p-3 sm:p-4 bg-gray-800/90 backdrop-blur-lg rounded-xl text-gray-100 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 shadow-lg border border-gray-700/50 hover:bg-gray-800 transition-all"
            rows={12}
            spellCheck={false}
            aria-label="System prompt editor"
          />
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={() => {
                localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPT, customPrompt);
                setOriginalPrompt(customPrompt);
                setHasChanges(false);
              }}
              disabled={!hasChanges}
              className={`flex-1 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg ${
                hasChanges
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-100'
                  : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
              }`}
            >
              💾 Save Changes
            </button>
            <button
              onClick={() => {
                setCustomPrompt(DEFAULT_STATIC_ROLE);
                localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPT, DEFAULT_STATIC_ROLE);
                setOriginalPrompt(DEFAULT_STATIC_ROLE);
                setHasChanges(false);
              }}
              className="flex-1 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base bg-gray-700/80 hover:bg-gray-700 text-gray-200 transition-all hover:scale-[1.02] active:scale-100 shadow-lg"
            >
              🔄 Reset to Default
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-700/50">
          <p className="text-gray-400 text-xs sm:text-sm text-center">
            Click outside or press <kbd className="px-2 py-1 bg-gray-800 rounded text-xs font-mono">ESC</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
