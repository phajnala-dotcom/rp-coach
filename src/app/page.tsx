'use client';

import { useLiveRPCoach } from '@/hooks/useLiveRPCoach';
import { DEFAULT_USER_PROFILE, STORAGE_KEYS } from '@/types';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    clearHistory,
    isGeneratingReport,
    audioLevel,
    transcriptLog,
    lastReport,
    isMuted,
    isPaused,
    toggleMute,
    togglePause,
  } = useLiveRPCoach();

  const [sessionDuration, setSessionDuration] = useState(0);
  const [initialBenchmark, setInitialBenchmark] = useState<any>(null);
  const [lastOverallScore, setLastOverallScore] = useState<number | null>(null);

  // Session timer (pause-aware)
  useEffect(() => {
    if (!isConnected) {
      setSessionDuration(0);
      return;
    }

    const interval = setInterval(() => {
      if (!isPaused) {
        setSessionDuration(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, isPaused]);

  // Load initial benchmark and last overall score
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const benchmark = localStorage.getItem(STORAGE_KEYS.INITIAL_BENCHMARK);
      if (benchmark) {
        setInitialBenchmark(JSON.parse(benchmark));
      }
      
      const lastReportStr = localStorage.getItem(STORAGE_KEYS.LAST_SESSION_REPORT);
      if (lastReportStr) {
        const report = JSON.parse(lastReportStr);
        setLastOverallScore(report.overall_rp_proficiency);
      }
    }
  }, []);

  // Update score when new report is generated
  useEffect(() => {
    if (lastReport?.overall_rp_proficiency !== undefined) {
      setLastOverallScore(lastReport.overall_rp_proficiency);
    }
  }, [lastReport]);

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
    <div className="min-h-screen p-6 md:p-12">
      {/* Settings Icon - Only visible on home page (when not connected) */}
      {!isConnected && (
        <Link href="/settings">
          <button
            className="fixed top-6 right-6 z-50 p-3 bg-gradient-to-br from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80 backdrop-blur-lg rounded-xl text-white transition-all transform hover:scale-110 shadow-xl"
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
        </Link>
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Voice Interface */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Voice Orb - UK Themed */}
            <div className="relative bg-gradient-to-br from-gray-900/50 via-slate-900/50 to-gray-900/50 backdrop-blur-xl rounded-3xl p-16 flex flex-col items-center justify-center min-h-[500px] shadow-2xl">
              {!isConnected ? (
                // Start Button
                <div className="text-center space-y-8">
                  {/* UK Flag - Artistic Union Jack */}
                  <div className="relative w-[264px] h-[264px] mx-auto" style={{marginTop: '-60px'}}>
                    {/* Visible blurred border using absolute positioned divs */}
                    <div className="absolute inset-0 rounded-full" style={{
                      background: 'radial-gradient(circle, rgba(0,40,104,0.4) 0%, rgba(200,16,46,0.3) 50%, transparent 100%)',
                      filter: 'blur(20px)',
                      transform: 'scale(1.2)'
                    }} />
                    <div className="uk-orb w-full h-full rounded-full flex items-center justify-center overflow-hidden relative z-10">
                      <svg className="w-[230px] h-[230px]" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
                        {/* Background Navy */}
                        <rect width="60" height="30" fill="#012169"/>
                        
                        {/* White diagonals */}
                        <path d="M 0,0 L 60,30 M 60,0 L 0,30" stroke="#FFF" strokeWidth="6"/>
                        
                        {/* Red diagonals */}
                        <path d="M 0,0 L 60,30 M 60,0 L 0,30" stroke="#C8102E" strokeWidth="4"/>
                        
                        {/* White cross */}
                        <path d="M 30,0 L 30,30 M 0,15 L 60,15" stroke="#FFF" strokeWidth="10"/>
                        
                        {/* Red cross */}
                        <path d="M 30,0 L 30,30 M 0,15 L 60,15" stroke="#C8102E" strokeWidth="6"/>
                        
                        {/* Diagonal white offset stripes for depth */}
                        <path d="M 0,0 L 60,30" stroke="#FFF" strokeWidth="6" opacity="0.3" transform="translate(1,-1)"/>
                        <path d="M 60,0 L 0,30" stroke="#FFF" strokeWidth="6" opacity="0.3" transform="translate(-1,-1)"/>
                      </svg>
                    </div>
                  </div>
                  
                  <button
                    onClick={startSession}
                    className="button-premium px-36 py-[19px] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 rounded-3xl text-5xl font-black transition-all transform hover:scale-110 shadow-2xl hover:shadow-blue-500/50 border-4 border-blue-400/40 hover:translate-y-[-2px] active:translate-y-0"
                    style={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3), 0 4px 6px rgba(0, 0, 0, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.2)',
                      marginTop: '50px'
                    }}
                  >
                    🎙️ Begin RP Coaching
                  </button>

                  {/* Last Overall Score Visualization */}
                  {lastOverallScore !== null && lastOverallScore !== undefined && (
                    <div className="mt-6 text-center space-y-4">
                      <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                        <span className="text-gray-300 text-lg font-medium">Last Session RP Proficiency:</span>
                        <span className={`text-3xl font-black ${
                          lastOverallScore >= 71 ? 'text-green-400' :
                          lastOverallScore >= 41 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {lastOverallScore}%
                        </span>
                      </div>
                      
                      {/* View Full Report Link */}
                      <div className="mt-4">
                        <Link href="/report">
                          <button className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg">
                            📊 View Full Evaluation Report
                          </button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Active Session
                <div className="text-center space-y-8">
                  
                  {/* Session Status Indicators */}
                  <div className="flex gap-4 justify-center items-center mb-4">
                    {isPaused && (
                      <div className="px-6 py-3 bg-yellow-600/80 backdrop-blur-lg rounded-xl text-white font-bold text-lg shadow-lg border-2 border-yellow-400/50 animate-pulse">
                        ⏸️ SESSION PAUSED
                      </div>
                    )}
                    {isMuted && (
                      <div className="px-6 py-3 bg-red-600/80 backdrop-blur-lg rounded-xl text-white font-bold text-lg shadow-lg border-2 border-red-400/50">
                        🔇 MIC MUTED
                      </div>
                    )}
                  </div>

                  {/* UK Flag - Matching Home Page Exactly */}
                  <div className="relative w-[264px] h-[264px] mx-auto" style={{marginTop: '-60px'}}>
                    {/* Blurred border - matching home page */}
                    <div className="absolute inset-0 rounded-full" style={{
                      background: `radial-gradient(circle, rgba(0,40,104,${0.4 + audioLevel * 0.004}) 0%, rgba(200,16,46,${0.3 + audioLevel * 0.003}) 50%, transparent 100%)`,
                      filter: `blur(${20 + audioLevel * 0.5}px)`,
                      transform: 'scale(1.2)',
                      transition: 'background 0.1s ease-out, filter 0.1s ease-out'
                    }} />
                    <div 
                      className="w-full h-full rounded-full flex items-center justify-center overflow-hidden relative z-10"
                      style={{
                        background: 'linear-gradient(135deg, #002868 0%, #c8102e 50%, #ffffff 100%)',
                        boxShadow: `
                          0 0 ${60 + audioLevel * 0.8}px rgba(200, 16, 46, ${0.4 + audioLevel * 0.006}),
                          0 0 ${100 + audioLevel * 1.2}px rgba(0, 40, 104, ${0.3 + audioLevel * 0.005}),
                          inset 0 0 80px rgba(255, 255, 255, 0.1)
                        `,
                        transform: `scale(${1 + audioLevel * 0.002})`,
                        transition: 'transform 0.1s ease-out, box-shadow 0.1s ease-out'
                      }}
                    >
                      {/* Union Jack SVG */}
                      <svg className="w-[230px] h-[230px] absolute" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
                        <rect width="60" height="30" fill="#012169"/>
                        <path d="M 0,0 L 60,30 M 60,0 L 0,30" stroke="#FFF" strokeWidth="6"/>
                        <path d="M 0,0 L 60,30 M 60,0 L 0,30" stroke="#C8102E" strokeWidth="4"/>
                        <path d="M 30,0 L 30,30 M 0,15 L 60,15" stroke="#FFF" strokeWidth="10"/>
                        <path d="M 30,0 L 30,30 M 0,15 L 60,15" stroke="#C8102E" strokeWidth="6"/>
                      </svg>
                      <div className="uk-flag-overlay" />
                      {/* Microphone Wave Icon */}
                      <div className="relative z-10">
                        {isRecording ? (
                          <div className="flex flex-col items-center">
                            <svg className="w-24 h-24 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            <div className="flex gap-1 mt-4">
                              <div className="w-1 h-8 bg-white/80 rounded-full animate-pulse" style={{animationDelay: '0s'}} />
                              <div className="w-1 h-12 bg-white/80 rounded-full animate-pulse" style={{animationDelay: '0.1s'}} />
                              <div className="w-1 h-6 bg-white/80 rounded-full animate-pulse" style={{animationDelay: '0.2s'}} />
                              <div className="w-1 h-10 bg-white/80 rounded-full animate-pulse" style={{animationDelay: '0.3s'}} />
                              <div className="w-1 h-8 bg-white/80 rounded-full animate-pulse" style={{animationDelay: '0.4s'}} />
                            </div>
                          </div>
                        ) : (
                          <svg className="w-32 h-32 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Session Control Buttons */}
                  <div className="flex flex-col gap-4 justify-center" style={{marginTop: '50px'}}>
                    
                    {/* Mic Mute and Pause buttons */}
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={toggleMute}
                        className={`px-8 py-4 rounded-xl text-lg font-bold transition-all transform hover:scale-105 shadow-lg ${
                          isMuted 
                            ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                        }`}
                      >
                        {isMuted ? '🔇 Unmute Mic' : '🎤 Mute Mic'}
                      </button>

                      <button
                        onClick={togglePause}
                        className={`px-8 py-4 rounded-xl text-lg font-bold transition-all transform hover:scale-105 shadow-lg ${
                          isPaused
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                            : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white'
                        }`}
                      >
                        {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                      </button>
                    </div>

                    {/* End Session button */}
                    <button
                      onClick={stopSession}
                      disabled={isGeneratingReport}
                      className="button-premium px-36 py-[19px] bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-2xl text-5xl font-black transition-all transform hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-rose-500/50 border-4 border-rose-400/40 hover:translate-y-[-2px] active:translate-y-0"
                      style={{
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        boxShadow: '0 8px 16px rgba(244, 63, 94, 0.3), 0 4px 6px rgba(0, 0, 0, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      {isGeneratingReport ? '📄 Analyzing...' : '⏹️ End Session'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-gradient-to-r from-red-900/40 to-rose-900/40 backdrop-blur-lg border-2 border-red-500/50 rounded-2xl p-5 text-red-200 shadow-xl shadow-red-900/30">
                <strong className="font-bold text-red-300">⚠️ Error: </strong>
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Current Focus */}
            {currentMetrics && (
              <div className="bg-gradient-to-br from-gray-900/60 via-slate-900/60 to-gray-900/60 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
                <h3 className="text-xl font-bold mb-5 pb-4 border-b border-gray-700/30 flex items-center gap-3">
                  <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Current Focus</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-blue-500/30">
                    <p className="text-sm text-gray-400 mb-1">Primary</p>
                    <p className="font-semibold text-blue-400">{currentMetrics.next_primary_focus}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-purple-500/30">
                    <p className="text-sm text-gray-400 mb-1">Secondary</p>
                    <p className="font-semibold text-purple-400">{currentMetrics.next_secondary_focus}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
                    <p className="text-sm text-gray-400 mb-1">Current Accuracy</p>
                    <p className="font-semibold text-green-400 text-lg">{currentMetrics.current_accuracy}%</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-yellow-500/30">
                    <p className="text-sm text-gray-400 mb-1">RP Level</p>
                    <p className="font-semibold text-yellow-400">{currentMetrics.rp_level}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Transcript Viewer - Debug Tool (Phase 1) */}
            {isConnected && transcriptLog.length > 0 && (
              <details className="bg-gradient-to-br from-gray-900/60 via-slate-900/60 to-gray-900/60 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
                <summary className="cursor-pointer font-bold text-lg mb-4 flex items-center gap-3 hover:text-blue-400 transition-colors">
                  <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    📝 Transcript ({transcriptLog.length} entries)
                  </span>
                </summary>
                <div className="mt-4 max-h-60 overflow-y-auto space-y-1 text-sm">
                  {transcriptLog.slice(-20).map((entry, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg ${
                        entry.speaker === 'user' 
                          ? 'bg-blue-900/30 border-l-4 border-blue-500' 
                          : 'bg-green-900/30 border-l-4 border-green-500'
                      }`}
                    >
                      <span className="font-semibold">
                        {entry.speaker === 'user' ? `${DEFAULT_USER_PROFILE.name}` : `${DEFAULT_USER_PROFILE.coach_name}`}:
                      </span>{' '}
                      <span className="text-gray-300">{entry.text}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Right Column - Progress Dashboard */}
          <div className="space-y-6">
            
            {/* Progress Overview */}
            <div className="bg-gradient-to-br from-gray-900/60 via-slate-900/60 to-gray-900/60 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-5 pb-4 border-b border-gray-700/30 flex items-center gap-3">
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Progress Overview</span>
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
                <div className="text-center py-8">
                  <p className="text-gray-500 text-base flex flex-col items-center gap-2">
                    <span className="text-4xl">📊</span>
                    No session data yet. Start your first session!
                  </p>
                </div>
              )}
            </div>

            {/* Session History */}
            <div className="bg-gradient-to-br from-gray-900/60 via-slate-900/60 to-gray-900/60 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-700/30">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">Session History</span>
                </h3>
                {sessionHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="button-premium text-sm text-red-400 hover:text-red-300 px-3 py-1 rounded-lg border border-red-500/30 hover:bg-red-900/20 transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>

              {sessionHistory.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                  {sessionHistory.slice().reverse().map((session) => (
                    <div
                      key={session.session_id}
                      className="bg-gray-800/60 rounded-xl p-4 text-sm hover:border-blue-500/50 transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-300 font-medium">
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                        <span className="text-blue-400 font-bold bg-blue-900/30 px-2 py-1 rounded-lg">
                          {session.duration_minutes}m
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mb-2 flex items-center gap-2">
                        <span className="text-purple-400">🎯</span> {session.metrics.next_primary_focus}
                      </p>
                      {session.achievements.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
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
                <div className="text-center py-8">
                  <p className="text-gray-500 text-base flex flex-col items-center gap-2">
                    <span className="text-4xl">📈</span>
                    No session data yet.
                  </p>
                </div>
              )}
            </div>

            {/* Comparison: Initial vs Current */}
            {initialBenchmark && currentMetrics && (
              <div className="bg-gradient-to-br from-gray-900/60 via-slate-900/60 to-gray-900/60 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
                <h3 className="text-xl font-bold mb-5 pb-4 border-b border-gray-700/30 flex items-center gap-3">
                  <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Growth Comparison</span>
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
        <footer className="mt-12 text-center">
          <p className="text-[10px] italic text-gray-400">
            Powered by Gemini 2.5 Flash Native Audio • Modern RP Coaching
          </p>
        </footer>
      </div>
    </div>
  );
}
