// ============================================================================
// LIVE GENAM COACH HOOK - Full-Duplex Audio with Gemini 2.5 Flash Native Audio
// ============================================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SessionMetrics,
  MetricsUpdate,
  ConnectionStatus,
  SessionHistory,
  TranscriptEntry,
  AsyncSessionReport,
  STORAGE_KEYS,
  DEFAULT_USER_PROFILE,
} from '@/types';
import { generateSessionId } from '@/lib/prompt-builder';

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
const RECONNECT_DELAY_MS = [1000, 2000, 5000, 10000]; // Exponential backoff

interface UseLiveRPCoachReturn {
  isConnected: boolean;
  isRecording: boolean;
  connectionStatus: ConnectionStatus;
  currentMetrics: SessionMetrics | null;
  sessionHistory: SessionHistory[];
  error: string | null;
  startSession: () => Promise<void>;
  stopSession: () => void;
  saveCheckpoint: () => void;
  clearHistory: () => void;
  isGeneratingReport: boolean;
  audioLevel: number; // 0-100 for audio visualization
  transcriptLog: TranscriptEntry[]; // New: Session transcript
  lastReport: AsyncSessionReport | null; // New: Last session report for UI
  isMuted: boolean; // Mic mute state
  isPaused: boolean; // Session pause state
  toggleMute: () => void; // Toggle mic mute
  togglePause: () => void; // Toggle session pause
  diagnosticTimeRemaining: number; // Phase 1: 2-minute diagnostic countdown
  diagnosticComplete: boolean; // Phase 1: Diagnostic finished flag
  currentScores: {
    overall: number;
    phonetics: number;
    intonation: number;
    stress: number;
  } | null; // Phase 1: Real-time scores from JSON
}

export function useLiveRPCoach(): UseLiveRPCoachReturn {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
  });
  const [currentMetrics, setCurrentMetrics] = useState<SessionMetrics | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 for audio visualization
  const [lastReport, setLastReport] = useState<AsyncSessionReport | null>(null);
  const [transcriptLog, setTranscriptLog] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false); // Mic mute state
  const [isPaused, setIsPaused] = useState(false); // Session pause state
  const [diagnosticTimeRemaining, setDiagnosticTimeRemaining] = useState(120); // 2 minutes
  const [diagnosticComplete, setDiagnosticComplete] = useState(false);
  const [currentScores, setCurrentScores] = useState<{
    overall: number;
    phonetics: number;
    intonation: number;
    stress: number;
  } | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTimeRef = useRef<Date | null>(null);
  const metricsUpdateCountRef = useRef(0);
  const currentSessionIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false); // Prevent multiple simultaneous connections
  const activeAudioSourcesRef = useRef<AudioBufferSourceNode[]>([]); // Track active playback
  const userSpeakingRef = useRef<boolean>(false); // Track if user is currently speaking
  const lastUserAudioTimeRef = useRef<number>(0); // Timestamp of last detected user audio
  const audioScheduleTimeRef = useRef<number>(0); // Track when next audio should play
  const shouldGenerateReportRef = useRef(false); // Track if report should be generated on session end
  const inputAnalyserRef = useRef<AnalyserNode | null>(null); // Track input audio levels
  const outputAnalyserRef = useRef<AnalyserNode | null>(null); // Track output audio levels
  const animationFrameRef = useRef<number | null>(null); // For audio level animation loop
  const transcriptLogRef = useRef<TranscriptEntry[]>([]); // Track transcript entries
  const pauseStartTimeRef = useRef<number>(0); // Track when pause started
  const totalPausedTimeRef = useRef<number>(0); // Total time spent paused
  const wakeLockRef = useRef<any>(null); // Screen Wake Lock for mobile

  // ============================================================================
  // STORAGE HELPERS
  // ============================================================================

  const loadFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const currentStatus = localStorage.getItem(STORAGE_KEYS.CURRENT_STATUS);
      if (currentStatus) {
        setCurrentMetrics(JSON.parse(currentStatus));
      }

      const history = localStorage.getItem(STORAGE_KEYS.SESSION_HISTORY);
      if (history) {
        setSessionHistory(JSON.parse(history));
      }
    } catch (err) {
      console.error('Failed to load from storage:', err);
    }
  }, []);

  const saveToStorage = useCallback((metrics: SessionMetrics) => {
    if (typeof window === 'undefined') return;

    try {
      // Save current status
      localStorage.setItem(STORAGE_KEYS.CURRENT_STATUS, JSON.stringify(metrics));

      // If this is the first benchmark, save it
      if (!localStorage.getItem(STORAGE_KEYS.INITIAL_BENCHMARK)) {
        localStorage.setItem(STORAGE_KEYS.INITIAL_BENCHMARK, JSON.stringify(metrics));
      }

      setCurrentMetrics(metrics);
    } catch (err) {
      console.error('Failed to save to storage:', err);
    }
  }, []);

  const saveSessionToHistory = useCallback((metrics: SessionMetrics, duration: number) => {
    if (typeof window === 'undefined') return;

    try {
      const newSession: SessionHistory = {
        session_id: metrics.session_id,
        date: new Date().toISOString(),
        duration_minutes: Math.round(duration / 60),
        metrics,
        achievements: metrics.mastery_confirmed ? [metrics.previous_focus] : [],
      };

      const history = [...sessionHistory, newSession].slice(-10); // Keep last 10
      localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(history));
      setSessionHistory(history);
    } catch (err) {
      console.error('Failed to save session history:', err);
    }
  }, [sessionHistory]);

  // ============================================================================
  // AUDIO SETUP
  // ============================================================================

  const setupAudio = useCallback(async () => {
    try {
      // iOS requires specific constraints and error handling
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // iOS Safari prefers these specific settings
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
        },
        video: false, // Explicitly disable video for iOS
      };

      // Request microphone access (must be called from user gesture on iOS)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (permissionError: any) {
        // iOS-specific error handling
        if (permissionError.name === 'NotAllowedError') {
          throw new Error('Microphone permission denied. Please enable microphone access in Settings > Safari > Camera & Microphone');
        } else if (permissionError.name === 'NotFoundError') {
          throw new Error('No microphone found on this device');
        } else if (permissionError.name === 'NotReadableError') {
          throw new Error('Microphone is already in use by another app');
        }
        throw permissionError;
      }

      audioStreamRef.current = stream;

      // Create audio context (iOS Safari requires user interaction)
      // Use default sample rate (typically 48kHz) for best quality
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported on this browser');
      }

      const audioContext = new AudioContextClass({ 
        // Don't force 16kHz - use system default (48kHz) for better quality
        // We'll resample the input for Gemini
        latencyHint: 'interactive',
      });
      
      // Resume immediately to handle iOS autoplay restrictions
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      audioContextRef.current = audioContext;

      // Create media stream source
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create script processor for audio chunks
      // Use larger buffer for better quality (less distortion)
      const processor = audioContext.createScriptProcessor(8192, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        // Skip processing if session is paused
        if (isPaused) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const inputSampleRate = e.inputBuffer.sampleRate;
        
        // Resample to 16kHz for Gemini if needed
        let processedData: Float32Array;
        if (inputSampleRate !== 16000) {
          // Simple downsampling (for quality, use proper resampling)
          const ratio = inputSampleRate / 16000;
          const outputLength = Math.floor(inputData.length / ratio);
          processedData = new Float32Array(outputLength);
          
          for (let i = 0; i < outputLength; i++) {
            const srcIndex = Math.floor(i * ratio);
            processedData[i] = inputData[srcIndex];
          }
        } else {
          processedData = inputData;
        }
        
        // Convert Float32Array to Int16Array (PCM16) with proper clamping
        const pcmData = new Int16Array(processedData.length);
        for (let i = 0; i < processedData.length; i++) {
          const s = Math.max(-1, Math.min(1, processedData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send audio data to WebSocket
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        wsRef.current.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm;rate=16000',
              data: base64Audio,
            }],
          },
        }));
        
        // Log user audio activity (detect when user speaks)
        // [AUDIO_DETECTED] serves as attempt counter for the analyzer
        // Pattern: 1 PETER:[AUDIO_DETECTED] + 1 ALEX:feedback = 1 attempt
        if (pcmData.length > 0) {
          const rms = Math.sqrt(
            processedData.reduce((sum: number, val: number) => sum + val * val, 0) / processedData.length
          );
          
          const SPEECH_THRESHOLD = 0.05; // Higher threshold to ignore ambient noise and distant speech
          
          if (rms > SPEECH_THRESHOLD) {
            const now = Date.now();
            lastUserAudioTimeRef.current = now;
            
            // User is speaking - immediately stop all AI audio playback
            if (!userSpeakingRef.current && activeAudioSourcesRef.current.length > 0) {
              console.log('🎤 User speaking detected - stopping AI audio');
              activeAudioSourcesRef.current.forEach(source => {
                try { 
                  source.stop(); 
                } catch (e) {
                  // Source may already be stopped
                }
              });
              activeAudioSourcesRef.current = [];
              // Reset audio schedule to allow immediate playback after user stops
              audioScheduleTimeRef.current = audioContextRef.current?.currentTime || 0;
            }
            
            userSpeakingRef.current = true;
            
            const entry: TranscriptEntry = {
              timestamp: now,
              speaker: 'user',
              text: '[AUDIO_DETECTED]', // Placeholder - marks one attempt
            };
            
            transcriptLogRef.current = [...transcriptLogRef.current, entry];
            setTranscriptLog(transcriptLogRef.current);
          } else {
            // Check if user stopped speaking (100ms of silence)
            if (userSpeakingRef.current && Date.now() - lastUserAudioTimeRef.current > 100) {
              userSpeakingRef.current = false;
            }
          }
        }
      };

      // Create analyser for input audio visualization
      const inputAnalyser = audioContext.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyserRef.current = inputAnalyser;
      
      source.connect(inputAnalyser);
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // iOS Background Support: Create silent oscillator to keep audio context alive
      // This prevents iOS from suspending the WebSocket when screen locks
      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 1; // 1Hz (inaudible)
        gainNode.gain.value = 0.001; // Near-silent volume
        oscillator.start();
        console.log('🍎 iOS keep-alive oscillator started (silent background audio)');
      } catch (e) {
        console.warn('Could not create iOS keep-alive oscillator:', e);
      }
      
      // Start monitoring input audio levels
      startAudioLevelMonitoring();
      
      setIsRecording(true);
      return true;
    } catch (err) {
      console.error('Audio setup failed:', err);
      setError('Microphone access denied or unavailable');
      return false;
    }
  }, []);

  const startAudioLevelMonitoring = useCallback(() => {
    const monitorLevel = () => {
      if (!inputAnalyserRef.current && !outputAnalyserRef.current) {
        return;
      }

      let maxLevel = 0;

      // Check input level
      if (inputAnalyserRef.current) {
        const dataArray = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
        inputAnalyserRef.current.getByteFrequencyData(dataArray);
        const inputLevel = Math.max(...dataArray) / 255;
        maxLevel = Math.max(maxLevel, inputLevel);
      }

      // Check output level
      if (outputAnalyserRef.current) {
        const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(dataArray);
        const outputLevel = Math.max(...dataArray) / 255;
        maxLevel = Math.max(maxLevel, outputLevel);
      }

      // Smooth the audio level (exponential moving average)
      setAudioLevel(prev => prev * 0.7 + maxLevel * 100 * 0.3);

      animationFrameRef.current = requestAnimationFrame(monitorLevel);
    };

    monitorLevel();
  }, []);

  const cleanupAudio = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;
    setAudioLevel(0);
    setIsRecording(false);
  }, []);

  // ============================================================================
  // WEBSOCKET SETUP
  // ============================================================================

  const connectWebSocket = useCallback(async (apiKey: string, systemInstruction: string) => {
    // Prevent multiple simultaneous connections
    if (isConnectingRef.current) {
      console.log('Connection already in progress, skipping');
      return wsRef.current;
    }

    // Close any existing connection first
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log('Closing existing connection');
      wsRef.current.close(1000, 'Starting new connection');
      wsRef.current = null;
    }

    // Stop all active audio playback
    activeAudioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeAudioSourcesRef.current = [];

    // Get settings from localStorage
    const voiceName = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.VOICE_PREFERENCE)) || 'Enceladus';
    const temperature = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.TEMPERATURE)) 
      ? parseFloat(localStorage.getItem(STORAGE_KEYS.TEMPERATURE)!) 
      : 1.0;

    isConnectingRef.current = true;

    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?key=${apiKey}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        isConnectingRef.current = false;
        
        // Send setup message
        ws.send(JSON.stringify({
          setup: {
            model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
            generationConfig: {
              responseModalities: ['AUDIO'], // Native Audio API only supports AUDIO modality
              temperature: temperature,
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName,
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
          },
        }));

        // Send initial trigger to make Alex start speaking first
        setTimeout(() => {
          console.log('📢 Sending initial trigger for Alex to greet...');
          ws.send(JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: 'START_SESSION'
                    }
                  ]
                }
              ],
              turnComplete: true
            }
          }));
        }, 500); // Small delay to ensure setup is complete

        setIsConnected(true);
        setConnectionStatus({
          connected: true,
          reconnecting: false,
          lastConnected: new Date(),
        });
        reconnectAttemptRef.current = 0;
        
        resolve(ws);
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        isConnectingRef.current = false;
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        isConnectingRef.current = false;
        setIsConnected(false);
        setConnectionStatus(prev => ({
          ...prev,
          connected: false,
        }));
        
        // Stop all active audio on disconnect
        activeAudioSourcesRef.current.forEach(source => {
          try { source.stop(); } catch (e) {}
        });
        activeAudioSourcesRef.current = [];
        
        // Save diagnostic scores if they exist (session expired before manual stop)
        if (currentScores && currentScores.overall > 0) {
          const report = {
            session_id: currentSessionIdRef.current || generateSessionId(),
            timestamp: new Date().toISOString(),
            duration_minutes: sessionStartTimeRef.current 
              ? Math.round((Date.now() - sessionStartTimeRef.current.getTime()) / 60000)
              : 0,
            overall_genam_proficiency: currentScores.overall,
            scores: currentScores,
            qualitative_evaluation: 'Session ended unexpectedly',
            focus_phonemes: [],
            exercise_types: [],
            priority_areas: [],
          };
          localStorage.setItem(STORAGE_KEYS.LAST_SESSION_REPORT, JSON.stringify(report));
          console.log('💾 Auto-saved diagnostic scores on session close:', currentScores.overall);
        }
        
        // Save transcript if exists
        if (transcriptLogRef.current.length > 0) {
          localStorage.setItem(
            STORAGE_KEYS.TRANSCRIPT_LOG,
            JSON.stringify(transcriptLogRef.current)
          );
          console.log(`💾 Auto-saved transcript on session close: ${transcriptLogRef.current.length} entries`);
        }
        
        // Only auto-reconnect if manually closed AND not too many attempts
        // Disabled auto-reconnect to prevent loops - user must manually restart
        // if (event.code !== 1000 && reconnectAttemptRef.current < RECONNECT_DELAY_MS.length) {
        //   attemptReconnect();
        // }
      };

      ws.onmessage = async (event) => {
        try {
          // Handle Blob (binary) messages
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            const data = JSON.parse(text);
            handleWebSocketMessage(data);
          } 
          // Handle string (JSON) messages
          else if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current = ws;
    });
  }, []);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= RECONNECT_DELAY_MS.length) {
      setError('Connection lost. Please refresh the page.');
      return;
    }

    const delay = RECONNECT_DELAY_MS[reconnectAttemptRef.current];
    setConnectionStatus(prev => ({
      ...prev,
      reconnecting: true,
      error: `Reconnecting in ${delay / 1000}s...`,
    }));

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptRef.current++;
      startSession();
    }, delay);
  }, []);

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  const handleWebSocketMessage = useCallback((data: any) => {
    // DEBUG: Log full message structure to understand Gemini's response format
    if (data.serverContent || data.setupComplete) {
      console.log('📨 WebSocket message received:', JSON.stringify(data, null, 2));
    }
    
    // Handle setup completion
    if (data.setupComplete) {
      console.log('Setup complete');
      return;
    }

    // CRITICAL FIX: Handle user transcription from Gemini's grounding attribution
    // When Gemini receives user audio, it may include transcription in groundingMetadata or userInput
    if (data.serverContent?.groundingMetadata?.userTranscript) {
      const userText = data.serverContent.groundingMetadata.userTranscript.trim();
      if (userText && userText !== '[AUDIO_DETECTED]') {
        const entry: TranscriptEntry = {
          timestamp: Date.now(),
          speaker: 'user',
          text: userText,
        };
        
        transcriptLogRef.current = [...transcriptLogRef.current, entry];
        setTranscriptLog(transcriptLogRef.current);
        console.log('📝 User transcript captured:', userText);
      }
    }

    // Alternative: Check if Gemini provides user turn data
    if (data.serverContent?.turnComplete && data.serverContent?.userTurn?.parts) {
      data.serverContent.userTurn.parts.forEach((part: any) => {
        if (part.text) {
          const userText = part.text.trim();
          if (userText) {
            const entry: TranscriptEntry = {
              timestamp: Date.now(),
              speaker: 'user',
              text: userText,
            };
            
            transcriptLogRef.current = [...transcriptLogRef.current, entry];
            setTranscriptLog(transcriptLogRef.current);
            console.log('📝 User transcript captured from turn:', userText);
          }
        }
      });
    }

    // Handle server content (audio + text)
    if (data.serverContent) {
      const { modelTurn } = data.serverContent;
      
      if (modelTurn?.parts) {
        // First pass: Extract diagnostic JSON if present (don't skip audio!)
        let diagnosticJsonFound = false;
        modelTurn.parts.forEach((part: any) => {
          if (part.text && !diagnosticJsonFound) {
            const serverContent = part.text.trim();
            if (serverContent) {
              // Phase 1: Check for diagnostic JSON
              const jsonMatch = serverContent.match(/\{[^}]*"diagnostic_complete"[^}]*\}/);
              if (jsonMatch && jsonMatch[0].includes('"diagnostic_complete"') && jsonMatch[0].includes('true')) {
                try {
                  const diagnosticData = JSON.parse(jsonMatch[0]);
                  console.log('📊 Diagnostic JSON received:', diagnosticData);
                  
                  // Extract scores
                  const scores = {
                    overall: diagnosticData.overall_proficiency_score || 0,
                    phonetics: diagnosticData.phonetics_score || 0,
                    intonation: diagnosticData.intonation_score || 0,
                    stress: diagnosticData.stress_score || 0,
                  };
                  
                  setCurrentScores(scores);
                  setDiagnosticComplete(true);
                  
                  // Only save to localStorage if overall score is valid (> 0)
                  // This ensures we don't overwrite previous valid scores with invalid ones
                  if (scores.overall > 0) {
                    const report = {
                      session_id: currentSessionIdRef.current || generateSessionId(),
                      timestamp: new Date().toISOString(),
                      duration_minutes: 3,
                      overall_genam_proficiency: scores.overall,
                      scores: scores,
                      qualitative_evaluation: diagnosticData.qualitative_evaluation || '',
                      focus_phonemes: diagnosticData.focus_phonemes || [],
                      exercise_types: diagnosticData.exercise_types || [],
                      priority_areas: diagnosticData.priority_areas || [],
                    };
                    
                    localStorage.setItem(STORAGE_KEYS.LAST_SESSION_REPORT, JSON.stringify(report));
                    setLastReport(report as any);
                    console.log('✅ Valid diagnostic scores saved to localStorage:', scores.overall);
                  } else {
                    console.log('⚠️ Diagnostic scores are 0 - not saving to localStorage (keeping previous valid scores)');
                  }
                  
                  // Play notification sound
                  if (audioContextRef.current) {
                    const oscillator = audioContextRef.current.createOscillator();
                    const gainNode = audioContextRef.current.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContextRef.current.destination);
                    oscillator.frequency.value = 800;
                    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3);
                    oscillator.start();
                    oscillator.stop(audioContextRef.current.currentTime + 0.3);
                  }
                  
                  console.log('✅ Diagnostic complete - UI updated');
                  
                  // Mark as found but continue processing audio in this message
                  diagnosticJsonFound = true;
                } catch (e) {
                  console.error('Failed to parse diagnostic JSON:', e);
                }
              }
            }
          }
        });
        
        // Second pass: Handle audio and non-JSON text
        modelTurn.parts.forEach((part: any) => {
          // Handle text responses (log to transcript) - skip if it was diagnostic JSON
          if (part.text && !diagnosticJsonFound) {
            const serverContent = part.text.trim();
            if (serverContent) {
              const entry: TranscriptEntry = {
                timestamp: Date.now(),
                speaker: 'model',
                text: serverContent,
              };
              
              transcriptLogRef.current = [...transcriptLogRef.current, entry];
              setTranscriptLog(transcriptLogRef.current);
              
              console.log('📝 Alex transcript captured:', serverContent);
              
              // Auto-enable report generation after meaningful conversation
              if (transcriptLogRef.current.length > 10) {
                shouldGenerateReportRef.current = true;
              }
              
              // Save to localStorage periodically (every 5 entries)
              if (transcriptLogRef.current.length % 5 === 0) {
                localStorage.setItem(
                  STORAGE_KEYS.TRANSCRIPT_LOG,
                  JSON.stringify(transcriptLogRef.current)
                );
              }
            }
          }

          // Handle audio responses (play back) - ALWAYS process audio
          if (part.inlineData?.mimeType?.startsWith('audio/')) {
            playAudioResponse(part.inlineData.data);
          }
        });
      }
    }

    // Handle tool calls or other server messages
    if (data.toolCall) {
      console.log('Tool call received:', data.toolCall);
    }
  }, []);

  // parseMetricsUpdate removed - Phase 1: No JSON parsing during live sessions

  const playAudioResponse = useCallback(async (base64Audio: string) => {
    try {
      console.log('🔊 Attempting to play audio response...');
      if (!audioContextRef.current) {
        console.error('❌ AudioContext not initialized');
        return;
      }

      // Resume AudioContext if suspended (required for iOS)
      if (audioContextRef.current.state === 'suspended') {
        console.log('▶️ Resuming suspended AudioContext...');
        await audioContextRef.current.resume();
      }
      
      console.log('✅ AudioContext state:', audioContextRef.current.state);

      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (PCM16)
      const pcm16 = new Int16Array(bytes.buffer);
      console.log(`🎵 Audio data: ${pcm16.length} samples`);
      
      // Gemini sends 24kHz audio - use it directly for best quality
      const sampleRate = 24000;
      const audioBuffer = audioContextRef.current.createBuffer(
        1, // mono
        pcm16.length,
        sampleRate
      );

      // Convert Int16 to Float32 with proper normalization
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        // Proper conversion: divide by 32768.0 for values, not 32767
        channelData[i] = pcm16[i] / 32768.0;
      }

      // Calculate when to start this audio chunk
      const currentTime = audioContextRef.current.currentTime;
      const startTime = Math.max(currentTime, audioScheduleTimeRef.current);
      
      // Update schedule time for next chunk
      audioScheduleTimeRef.current = startTime + audioBuffer.duration;
      
      console.log(`⏰ Playing audio at ${startTime.toFixed(2)}s (duration: ${audioBuffer.duration.toFixed(2)}s)`);

      // Play the audio at scheduled time
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect audio source
      source.connect(audioContextRef.current.destination);
      
      // Create output analyser if it doesn't exist (for visualization)
      if (!outputAnalyserRef.current) {
        try {
          const outputAnalyser = audioContextRef.current.createAnalyser();
          outputAnalyser.fftSize = 256;
          outputAnalyserRef.current = outputAnalyser;
          source.connect(outputAnalyser);
        } catch (e) {
          console.warn('Could not create output analyser:', e);
        }
      } else {
        source.connect(outputAnalyserRef.current);
      }
      
      // Track this source
      activeAudioSourcesRef.current.push(source);
      
      // Remove from tracking when finished
      source.onended = () => {
        const index = activeAudioSourcesRef.current.indexOf(source);
        if (index > -1) {
          activeAudioSourcesRef.current.splice(index, 1);
        }
      };
      
      // Start at scheduled time for smooth playback
      source.start(startTime);
      
    } catch (err) {
      console.error('Failed to play audio response:', err);
    }
  }, []);

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  const startSession = useCallback(async () => {
    // Prevent starting if already connected
    if (isConnected || isConnectingRef.current) {
      console.log('Session already active or connecting');
      return;
    }

    try {
      setError(null);
      
      // Reset diagnostic state
      setDiagnosticTimeRemaining(120); // 2 minutes
      setDiagnosticComplete(false);
      setCurrentScores(null);

      // Clean up any existing session first
      if (wsRef.current || audioContextRef.current) {
        console.log('Cleaning up existing session before starting new one');
        stopSession();
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay for cleanup
      }

      // Load last session report from storage (Phase 2)
      const lastReportStr = localStorage.getItem(STORAGE_KEYS.LAST_SESSION_REPORT);
      const lastReport = lastReportStr ? JSON.parse(lastReportStr) : null;
      
      if (lastReport) {
        console.log('📊 Loading previous session report:', {
          sessionId: lastReport.session_id,
          overallScore: lastReport.overall_genam_proficiency,
          timestamp: lastReport.timestamp,
        });
      } else {
        console.log('📊 No previous session report found (first session)');
      }
      
      // Fallback to legacy metrics if no report exists (Phase 1 compatibility)
      const storedMetrics = localStorage.getItem(STORAGE_KEYS.CURRENT_STATUS);
      const metrics = storedMetrics ? JSON.parse(storedMetrics) : null;

      // Generate new session ID
      const sessionId = generateSessionId();
      currentSessionIdRef.current = sessionId;
      sessionStartTimeRef.current = new Date();

      // Get settings from localStorage
      const voiceName = localStorage.getItem(STORAGE_KEYS.VOICE_PREFERENCE) || 'Enceladus';
      const temperature = localStorage.getItem(STORAGE_KEYS.TEMPERATURE) 
        ? parseFloat(localStorage.getItem(STORAGE_KEYS.TEMPERATURE)!) 
        : 0.6;

      // Get session config from API (send report if available)
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastReport,       // Phase 2: AsyncSessionReport
          metrics,          // Phase 1 fallback: SessionMetrics
          userProfile: DEFAULT_USER_PROFILE,
          temperature,
          voiceName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize session');
      }

      const { config, systemInstruction } = await response.json();

      // Connect WebSocket
      await connectWebSocket(config.apiKey, systemInstruction);

      // Setup audio
      await setupAudio();

    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setConnectionStatus({
        connected: false,
        reconnecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      });
    }
  }, [connectWebSocket, setupAudio]);

  // PHASE 1: Async analysis removed - using real-time diagnostic JSON instead
  const generateSessionReport = useCallback(async () => {
    console.log('📊 Report generation: Using diagnostic scores from session (async analysis removed)');
    
    // No-op: Report is now generated during session via diagnostic JSON
    // Scores are saved to localStorage in real-time by message handler
    setIsGeneratingReport(false);
  }, []);

  const stopSession = useCallback(async () => {
    console.log('Stopping session...');
    
    // Stop all active audio immediately
    activeAudioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeAudioSourcesRef.current = [];
    audioScheduleTimeRef.current = 0; // Reset audio schedule

    // Save final transcript
    if (transcriptLogRef.current.length > 0) {
      localStorage.setItem(
        STORAGE_KEYS.TRANSCRIPT_LOG,
        JSON.stringify(transcriptLogRef.current)
      );
      console.log(`Session ended. Transcript entries: ${transcriptLogRef.current.length}`);
    }
    
    // Always generate async analysis report if session had enough content
    if (transcriptLogRef.current.length > 5) {
      await generateSessionReport();
    }
    
    // Clear transcript for next session
    transcriptLogRef.current = [];
    setTranscriptLog([]);
    
    // Calculate session duration
    if (sessionStartTimeRef.current && currentMetrics) {
      const duration = (Date.now() - sessionStartTimeRef.current.getTime()) / 1000;
      saveSessionToHistory(currentMetrics, duration);
    }

    // Generate OLD-STYLE report if requested (Phase 1 legacy)
    if (shouldGenerateReportRef.current && currentMetrics) {
      setIsGeneratingReport(true);
      shouldGenerateReportRef.current = false;
      
      try {
        const initialBenchmarkStr = localStorage.getItem(STORAGE_KEYS.INITIAL_BENCHMARK);
        const initialBenchmark = initialBenchmarkStr ? JSON.parse(initialBenchmarkStr) : null;
        
        const isFirstReport = !initialBenchmark;
        const reportDate = new Date().toLocaleString('en-GB', { 
          dateStyle: 'full', 
          timeStyle: 'short' 
        });

        let reportContent = '';

        if (isFirstReport) {
          // INITIAL BENCHMARK REPORT
          reportContent = `
╔═══════════════════════════════════════════════════════════════╗
║          MODERN RP PRONUNCIATION - INITIAL BENCHMARK          ║
╚═══════════════════════════════════════════════════════════════╝

Student: ${DEFAULT_USER_PROFILE.name}
Date: ${reportDate}
Coach: ${DEFAULT_USER_PROFILE.coach_name}
Session ID: ${currentMetrics.session_id}
Session Duration: ${Math.round((Date.now() - (sessionStartTimeRef.current?.getTime() || Date.now())) / 60000)} minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BASELINE ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┊ GENAM PROFICIENCY LEVEL: ${currentMetrics.genam_level}

🎯 ACCURACY METRICS:
   Overall Accuracy:        ${currentMetrics.current_accuracy}%
   Assessment Confidence:   ${currentMetrics.confidence_score}%

🗣️ PRONUNCIATION ANALYSIS:
   Primary Challenge:       ${currentMetrics.next_primary_focus}
   Secondary Challenge:     ${currentMetrics.next_secondary_focus}
   
❌ IDENTIFIED ERRORS:
   ${currentMetrics.residual_error}

🎵 PROSODY ASSESSMENT:
   Intonation Issues:       ${currentMetrics.prosody_gaps}
   Pitch Variance:          ${currentMetrics.pitch_variance}

📝 SESSION NOTES:
   ${currentMetrics.session_notes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TRAINING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next Session Focus:
1. Primary:   ${currentMetrics.next_primary_focus}
2. Secondary: ${currentMetrics.next_secondary_focus}

This baseline establishes your starting point. All future progress
reports will measure improvement against these initial metrics.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated by GenAm Coach • Powered by Gemini 2.5 Flash
`;
        } else {
          // PROGRESS REPORT
          const accuracyGain = currentMetrics.current_accuracy - initialBenchmark.current_accuracy;
          const confidenceGain = currentMetrics.confidence_score - initialBenchmark.confidence_score;
          const levelImproved = currentMetrics.genam_level !== initialBenchmark.genam_level;
          const sessionCount = sessionHistory.length + 1;
          
          reportContent = `
╔═══════════════════════════════════════════════════════════════╗
║       GENERAL AMERICAN PRONUNCIATION - PROGRESS REPORT         ║
╚═══════════════════════════════════════════════════════════════╝

Student: ${DEFAULT_USER_PROFILE.name}
Date: ${reportDate}
Session #${sessionCount}
Session ID: ${currentMetrics.session_id}
Session Duration: ${Math.round((Date.now() - (sessionStartTimeRef.current?.getTime() || Date.now())) / 60000)} minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PROGRESS OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 GENAM LEVEL:
   Initial:  ${initialBenchmark.genam_level}
   Current:  ${currentMetrics.genam_level} ${levelImproved ? '✅ IMPROVED!' : ''}

🎯 ACCURACY METRICS:
   Initial Accuracy:    ${initialBenchmark.current_accuracy}%
   Current Accuracy:    ${currentMetrics.current_accuracy}%
   Progress:            ${accuracyGain >= 0 ? '+' : ''}${accuracyGain.toFixed(1)}% ${accuracyGain > 5 ? '🎉' : accuracyGain > 0 ? '📈' : ''}
   
   Initial Confidence:  ${initialBenchmark.confidence_score}%
   Current Confidence:  ${currentMetrics.confidence_score}%
   Progress:            ${confidenceGain >= 0 ? '+' : ''}${confidenceGain.toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CURRENT SESSION FOCUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Working On:
   ${currentMetrics.previous_focus}
   Status: ${currentMetrics.mastery_confirmed ? '✅ MASTERED' : `${currentMetrics.current_accuracy}% accuracy`}

❌ Remaining Challenges:
   ${currentMetrics.residual_error}

🎵 Prosody Status:
   ${currentMetrics.prosody_gaps}
   Pitch Variance: ${currentMetrics.pitch_variance}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NEXT SESSION TARGETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Primary:   ${currentMetrics.next_primary_focus}
2. Secondary: ${currentMetrics.next_secondary_focus}

📝 Coach Notes:
   ${currentMetrics.session_notes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACHIEVEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sessionHistory.filter(s => s.achievements.length > 0).map(s => 
  `• ${new Date(s.date).toLocaleDateString('en-GB')}: ${s.achievements.join(', ')}`
).join('\n') || 'No mastered elements yet - keep practicing!'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated by GenAm Coach • Powered by Gemini 2.5 Flash
`;
        }

        // Create downloadable text file (works on iPhone)
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = isFirstReport 
          ? `RP-Initial-Benchmark-${DEFAULT_USER_PROFILE.name}.txt`
          : `RP-Progress-Report-${new Date().toISOString().split('T')[0]}.txt`;
        
        link.click();
        URL.revokeObjectURL(url);
        
        console.log(isFirstReport ? 'Initial benchmark report generated' : 'Progress report generated');
        
      } catch (err) {
        console.error('Failed to generate report:', err);
      } finally {
        setIsGeneratingReport(false);
      }
    }

    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'User stopped session');
      } catch (e) {
        console.error('Error closing WebSocket:', e);
      }
      wsRef.current = null;
    }

    // Cleanup audio
    cleanupAudio();

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset flags
    isConnectingRef.current = false;
    setIsConnected(false);
    setConnectionStatus({ connected: false, reconnecting: false });
    sessionStartTimeRef.current = null;
    metricsUpdateCountRef.current = 0;
  }, [cleanupAudio, currentMetrics, saveSessionToHistory, generateSessionReport]);

  const saveCheckpoint = useCallback(() => {
    if (!isConnected) {
      setError('Start a session first');
      return;
    }
    
    shouldGenerateReportRef.current = true;
    console.log('Report will be generated when session ends');
  }, [isConnected]);

  const clearHistory = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    if (confirm('Are you sure you want to clear all session history? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEYS.SESSION_HISTORY);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_STATUS);
      setSessionHistory([]);
      setCurrentMetrics(null);
    }
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load data on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
      // Release wake lock if active
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [stopSession]);

  // ============================================================================
  // DIAGNOSTIC TIMER (2-MINUTE COUNTDOWN)
  // ============================================================================

  useEffect(() => {
    if (!isConnected || diagnosticComplete || isPaused) return;

    const interval = setInterval(() => {
      setDiagnosticTimeRemaining(prev => {
        if (prev <= 1) {
          // Timer reached zero - send DIAGNOSTIC_COMPLETE signal
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log('⏰ 3-minute diagnostic period complete - sending signal to model');
            wsRef.current.send(JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: 'DIAGNOSTIC_COMPLETE'
                      }
                    ]
                  }
                ],
                turnComplete: true
              }
            }));
          }
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, diagnosticComplete, isPaused]);

  // ============================================================================
  // MIC MUTE CONTROL
  // ============================================================================

  const toggleMute = useCallback(() => {
    if (!audioStreamRef.current) return;
    
    const audioTracks = audioStreamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    
    setIsMuted(prev => !prev);
  }, []);

  // ============================================================================
  // SESSION PAUSE/RESUME CONTROL
  // ============================================================================

  const togglePause = useCallback(() => {
    if (!isConnected) return;

    if (isPaused) {
      // Resume session
      const pauseDuration = Date.now() - pauseStartTimeRef.current;
      totalPausedTimeRef.current += pauseDuration;
      setIsPaused(false);
      console.log(`⏯️ Session resumed (paused for ${Math.round(pauseDuration / 1000)}s)`);
    } else {
      // Pause session
      pauseStartTimeRef.current = Date.now();
      setIsPaused(true);
      console.log('⏸️ Session paused');
    }
  }, [isConnected, isPaused]);

  // ============================================================================
  // SCREEN WAKE LOCK (for mobile devices)
  // ============================================================================

  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    try {
      // Check if Wake Lock API is supported
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('🔒 Screen wake lock acquired');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('🔓 Screen wake lock released');
        });
      }
    } catch (err) {
      console.warn('Wake lock not available:', err);
    }
  }, []);

  // Request wake lock when session starts
  useEffect(() => {
    if (isConnected && !wakeLockRef.current) {
      requestWakeLock();
    }
  }, [isConnected, requestWakeLock]);

  return {
    isConnected,
    isRecording,
    connectionStatus,
    currentMetrics,
    sessionHistory,
    error,
    startSession,
    stopSession,
    saveCheckpoint,
    clearHistory,
    isGeneratingReport,
    audioLevel,
    transcriptLog,
    lastReport,
    isMuted,
    isPaused,
    toggleMute,
    togglePause,
    diagnosticTimeRemaining,
    diagnosticComplete,
    currentScores,
  };
}
