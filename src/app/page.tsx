'use client';

import { useLiveRPCoach } from '@/hooks/useLiveRPCoach';
import { DEFAULT_USER_PROFILE, STORAGE_KEYS } from '@/types';
import { useEffect, useState } from 'react';

export default function Home() {
  const {
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
  } = useLiveRPCoach();

  const [sessionDuration, setSessionDuration] = useState(0);
  const [initialBenchmark, setInitialBenchmark] = useState<any>(null);

  // Session timer
  useEffect(() => {
    if (!isConnected) {
      setSessionDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Load initial benchmark
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const benchmark = localStorage.getItem(STORAGE_KEYS.INITIAL_BENCHMARK);
      if (benchmark) {
        setInitialBenchmark(JSON.parse(benchmark));
      }
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionStatusColor = () => {
    if (connectionStatus.reconnecting) return 'bg-warning';
    if (connectionStatus.connected) return 'bg-success';
    return 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            RP Native Coach
          </h1>
          <p className="text-gray-400 text-lg">
            Your personal Modern RP pronunciation coach, <span className="text-blue-400 font-semibold">Steve</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Welcome back, {DEFAULT_USER_PROFILE.name} 👋
          </p>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Voice Interface */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Connection Status Bar */}
            <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between border border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getConnectionStatusColor()} animate-pulse`} />
                <span className="text-sm font-medium">
                  {connectionStatus.reconnecting
                    ? 'Reconnecting...'
                    : connectionStatus.connected
                    ? 'Connected'
                    : 'Disconnected'}
                </span>
                {connectionStatus.error && (
                  <span className="text-xs text-red-400">({connectionStatus.error})</span>
                )}
              </div>
              
              {isConnected && (
                <div className="text-sm text-gray-400">
                  Session: {formatDuration(sessionDuration)}
                </div>
              )}
            </div>

            {/* Voice Orb */}
            <div className="bg-gray-800 rounded-2xl p-12 border border-gray-700 flex flex-col items-center justify-center min-h-[400px]">
              {!isConnected ? (
                // Start Button
                <div className="text-center space-y-6">
                  <div className="w-40 h-40 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-20 w-20 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>
                  
                  <button
                    onClick={startSession}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-full text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
                  >
                    Start Coaching Session
                  </button>
                  
                  <p className="text-gray-400 text-sm max-w-md">
                    Click to begin your full-duplex voice session with Steve.
                    Make sure your microphone is enabled.
                  </p>
                </div>
              ) : (
                // Active Session
                <div className="text-center space-y-8">
                  <div
                    className={`w-48 h-48 mx-auto rounded-full flex items-center justify-center shadow-2xl ${
                      isRecording
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 orb-listening'
                        : 'bg-gradient-to-br from-gray-600 to-gray-700 orb-pulse'
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-24 w-24 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>

                  <div className="space-y-2">
                    <p className="text-2xl font-semibold text-blue-400">
                      {isRecording ? 'Listening...' : 'Processing...'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Speak naturally with Steve
                    </p>
                  </div>

                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={saveCheckpoint}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-all"
                    >
                      Save Checkpoint
                    </button>
                    <button
                      onClick={stopSession}
                      className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-all"
                    >
                      End Session
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 text-red-200">
                <strong className="font-semibold">Error: </strong>
                {error}
              </div>
            )}

            {/* Current Focus */}
            {currentMetrics && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  Current Focus
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Primary</p>
                    <p className="font-medium text-blue-400">{currentMetrics.next_primary_focus}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Secondary</p>
                    <p className="font-medium text-purple-400">{currentMetrics.next_secondary_focus}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Current Accuracy</p>
                    <p className="font-medium text-green-400">{currentMetrics.current_accuracy}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">RP Level</p>
                    <p className="font-medium text-yellow-400">{currentMetrics.rp_level}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Progress Dashboard */}
          <div className="space-y-6">
            
            {/* Progress Overview */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Progress Overview
              </h3>
              
              {currentMetrics ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Overall Progress</span>
                      <span className="font-medium">{currentMetrics.current_accuracy}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${currentMetrics.current_accuracy}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400 mb-1">Confidence Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-yellow-500 h-2 rounded-full"
                          style={{ width: `${currentMetrics.confidence_score}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{currentMetrics.confidence_score}%</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Residual Errors</p>
                    <p className="text-sm text-red-300">{currentMetrics.residual_error}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400 mb-2">Prosody Gaps</p>
                    <p className="text-sm text-orange-300">{currentMetrics.prosody_gaps}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400 mb-2">Pitch Variance</p>
                    <p className="text-sm text-purple-300">{currentMetrics.pitch_variance}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No session data yet. Start your first session!</p>
              )}
            </div>

            {/* Session History */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-2xl">📅</span>
                  Session History
                </h3>
                {sessionHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear
                  </button>
                )}
              </div>

              {sessionHistory.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {sessionHistory.slice().reverse().map((session) => (
                    <div
                      key={session.session_id}
                      className="bg-gray-700/50 rounded-lg p-3 text-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-400">
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                        <span className="text-blue-400 font-medium">
                          {session.duration_minutes}m
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mb-1">
                        Focus: {session.metrics.next_primary_focus}
                      </p>
                      {session.achievements.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {session.achievements.map((achievement, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-green-600/30 text-green-300 px-2 py-0.5 rounded"
                            >
                              ✓ {achievement}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No sessions yet.</p>
              )}
            </div>

            {/* Comparison: Initial vs Current */}
            {initialBenchmark && currentMetrics && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-2xl">📈</span>
                  Growth
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">RP Level</p>
                    <p className="font-medium">
                      {initialBenchmark.rp_level} → {currentMetrics.rp_level}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Accuracy</p>
                    <p className="font-medium text-green-400">
                      {initialBenchmark.current_accuracy}% → {currentMetrics.current_accuracy}%
                      <span className="text-xs ml-2">
                        (+{currentMetrics.current_accuracy - initialBenchmark.current_accuracy}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Powered by Gemini 2.5 Flash Native Audio • Modern RP Coaching</p>
        </footer>
      </div>
    </div>
  );
}
