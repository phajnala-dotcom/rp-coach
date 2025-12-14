// ============================================================================
// LIVE RP COACH HOOK - Full-Duplex Audio with Gemini 2.5 Flash Native Audio
// ============================================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SessionMetrics,
  MetricsUpdate,
  ConnectionStatus,
  SessionHistory,
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
  const audioScheduleTimeRef = useRef<number>(0); // Track when next audio should play
  const shouldGenerateReportRef = useRef(false); // Track if report should be generated on session end
  const inputAnalyserRef = useRef<AnalyserNode | null>(null); // Track input audio levels
  const outputAnalyserRef = useRef<AnalyserNode | null>(null); // Track output audio levels
  const animationFrameRef = useRef<number | null>(null); // For audio level animation loop

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
      };

      // Create analyser for input audio visualization
      const inputAnalyser = audioContext.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyserRef.current = inputAnalyser;
      
      source.connect(inputAnalyser);
      source.connect(processor);
      processor.connect(audioContext.destination);
      
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

    isConnectingRef.current = true;

    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?key=${apiKey}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        isConnectingRef.current = false;
        
        // Send setup message
        ws.send(JSON.stringify({
          setup: {
            model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Enceladus',
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
          },
        }));

        // Send initial trigger to make Steve start speaking first
        setTimeout(() => {
          console.log('📢 Sending initial trigger for Steve to greet...');
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
    // Handle setup completion
    if (data.setupComplete) {
      console.log('Setup complete');
      return;
    }

    // Handle server content (audio + text)
    if (data.serverContent) {
      const { modelTurn } = data.serverContent;
      
      if (modelTurn?.parts) {
        modelTurn.parts.forEach((part: any) => {
          // Handle text responses (metrics updates)
          if (part.text) {
            parseMetricsUpdate(part.text);
          }

          // Handle audio responses (play back)
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

  const parseMetricsUpdate = useCallback((text: string) => {
    try {
      // Look for JSON in the text
      const jsonMatch = text.match(/\{[\s\S]*"metrics_update"[\s\S]*\}/);
      if (!jsonMatch) return;

      const update: MetricsUpdate = JSON.parse(jsonMatch[0]);
      
      if (update.metrics_update) {
        console.log('Metrics update received:', update);
        saveToStorage(update.metrics_update);
        metricsUpdateCountRef.current++;

        // Handle trigger events
        if (update.trigger_event === 'SHIFT_FOCUS') {
          console.log('Focus shifted to:', update.metrics_update.next_primary_focus);
        } else if (update.trigger_event === 'BENCHMARK_COMPLETE') {
          console.log('Benchmark complete');
        }
      }
    } catch (err) {
      console.error('Failed to parse metrics update:', err);
    }
  }, [saveToStorage]);

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

      // Clean up any existing session first
      if (wsRef.current || audioContextRef.current) {
        console.log('Cleaning up existing session before starting new one');
        stopSession();
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay for cleanup
      }

      // Load current metrics from storage
      const storedMetrics = localStorage.getItem(STORAGE_KEYS.CURRENT_STATUS);
      const metrics = storedMetrics ? JSON.parse(storedMetrics) : null;

      // Generate new session ID
      const sessionId = generateSessionId();
      currentSessionIdRef.current = sessionId;
      sessionStartTimeRef.current = new Date();

      // Get session config from API
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics,
          userProfile: DEFAULT_USER_PROFILE,
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

  const stopSession = useCallback(async () => {
    console.log('Stopping session...');
    
    // Stop all active audio immediately
    activeAudioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeAudioSourcesRef.current = [];
    audioScheduleTimeRef.current = 0; // Reset audio schedule

    // Calculate session duration
    if (sessionStartTimeRef.current && currentMetrics) {
      const duration = (Date.now() - sessionStartTimeRef.current.getTime()) / 1000;
      saveSessionToHistory(currentMetrics, duration);
    }

    // Generate report if requested
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

📊 RP PROFICIENCY LEVEL: ${currentMetrics.rp_level}

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

Generated by RP Native Coach • Powered by Gemini 2.5 Flash
`;
        } else {
          // PROGRESS REPORT
          const accuracyGain = currentMetrics.current_accuracy - initialBenchmark.current_accuracy;
          const confidenceGain = currentMetrics.confidence_score - initialBenchmark.confidence_score;
          const levelImproved = currentMetrics.rp_level !== initialBenchmark.rp_level;
          const sessionCount = sessionHistory.length + 1;
          
          reportContent = `
╔═══════════════════════════════════════════════════════════════╗
║          MODERN RP PRONUNCIATION - PROGRESS REPORT            ║
╚═══════════════════════════════════════════════════════════════╝

Student: ${DEFAULT_USER_PROFILE.name}
Date: ${reportDate}
Session #${sessionCount}
Session ID: ${currentMetrics.session_id}
Session Duration: ${Math.round((Date.now() - (sessionStartTimeRef.current?.getTime() || Date.now())) / 60000)} minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PROGRESS OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RP LEVEL:
   Initial:  ${initialBenchmark.rp_level}
   Current:  ${currentMetrics.rp_level} ${levelImproved ? '✅ IMPROVED!' : ''}

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

Generated by RP Native Coach • Powered by Gemini 2.5 Flash
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
  }, [cleanupAudio, currentMetrics, saveSessionToHistory]);

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
    };
  }, [stopSession]);

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
  };
}
