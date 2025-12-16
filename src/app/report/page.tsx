'use client';

import { useEffect, useState } from 'react';
import { AsyncSessionReport, STORAGE_KEYS } from '@/types';
import Link from 'next/link';

export default function ReportPage() {
  const [report, setReport] = useState<AsyncSessionReport | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const reportStr = localStorage.getItem(STORAGE_KEYS.LAST_SESSION_REPORT);
      if (reportStr) {
        setReport(JSON.parse(reportStr));
      }
    }
  }, []);

  if (!report) {
    return (
      <div className="min-h-screen p-6 md:p-12 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">No Session Report Available</h1>
          <p className="text-gray-400 mb-6">Complete a coaching session to see your evaluation report.</p>
          <Link href="/" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all">
            Start Session
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'MASTERED': return 'text-green-400 bg-green-900/30 border-green-500/50';
      case 'GOOD': return 'text-blue-400 bg-blue-900/30 border-blue-500/50';
      case 'IMPROVING': return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/50';
      case 'NEEDS_WORK': return 'text-red-400 bg-red-900/30 border-red-500/50';
      default: return 'text-gray-400 bg-gray-900/30 border-gray-500/50';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 71) return 'text-green-400';
    if (score >= 41) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen p-4 md:p-12">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Session Evaluation Report
          </h1>
          <Link href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition-all">
            ← Home
          </Link>
        </div>

        {/* Session Info */}
        <div className="bg-gradient-to-br from-gray-900/80 to-slate-900/80 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-700/50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-400">Session Date</p>
              <p className="font-bold text-white">{new Date(report.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Duration</p>
              <p className="font-bold text-white">{report.duration_minutes} minutes</p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-sm text-gray-400">Overall RP Proficiency</p>
              <p className={`text-3xl font-black ${getScoreColor(report.overall_rp_proficiency)}`}>
                {report.overall_rp_proficiency}%
              </p>
            </div>
          </div>
        </div>

        {/* Category Scores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Phonetics */}
          <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-blue-500/30">
            <h3 className="text-xl font-bold text-blue-300 mb-2">Phonetics</h3>
            <p className={`text-4xl font-black ${getScoreColor(report.categories.phonetics.weighted_score)}`}>
              {report.categories.phonetics.weighted_score}%
            </p>
          </div>

          {/* Intonation */}
          <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-purple-500/30">
            <h3 className="text-xl font-bold text-purple-300 mb-2">Intonation</h3>
            <p className={`text-4xl font-black ${getScoreColor(report.categories.intonation.weighted_score)}`}>
              {report.categories.intonation.weighted_score}%
            </p>
          </div>

          {/* Stress & Rhythm */}
          <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-green-500/30">
            <h3 className="text-xl font-bold text-green-300 mb-2">Stress & Rhythm</h3>
            <p className={`text-4xl font-black ${getScoreColor(report.categories.stress_rhythm.weighted_score)}`}>
              {report.categories.stress_rhythm.weighted_score}%
            </p>
          </div>
        </div>

        {/* Detailed Attempts Table - Phonetics */}
        {report.categories.phonetics.items.length > 0 && (
          <div className="bg-gradient-to-br from-gray-900/80 to-slate-900/80 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-700/50">
            <h2 className="text-2xl font-bold mb-4 text-blue-300">📊 Phonetics - All Attempts</h2>
            <div className="space-y-2">
              {report.categories.phonetics.items.map((item, idx) => (
                <div key={idx} className={`p-4 rounded-xl border-2 ${getStatusColor(item.status)}`}>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="font-bold text-lg">{item.name}</span>
                    <div className="flex gap-4 items-center">
                      <span className="text-sm opacity-75">{item.attempts} attempts</span>
                      <span className="text-2xl font-black">{item.score}%</span>
                      <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase">{item.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Attempts Table - Intonation */}
        {report.categories.intonation.items.length > 0 && (
          <div className="bg-gradient-to-br from-gray-900/80 to-slate-900/80 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-700/50">
            <h2 className="text-2xl font-bold mb-4 text-purple-300">🎵 Intonation - All Attempts</h2>
            <div className="space-y-2">
              {report.categories.intonation.items.map((item, idx) => (
                <div key={idx} className={`p-4 rounded-xl border-2 ${getStatusColor(item.status)}`}>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="font-bold text-lg">{item.name}</span>
                    <div className="flex gap-4 items-center">
                      <span className="text-sm opacity-75">{item.attempts} attempts</span>
                      <span className="text-2xl font-black">{item.score}%</span>
                      <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase">{item.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Attempts Table - Stress & Rhythm */}
        {report.categories.stress_rhythm.items.length > 0 && (
          <div className="bg-gradient-to-br from-gray-900/80 to-slate-900/80 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-700/50">
            <h2 className="text-2xl font-bold mb-4 text-green-300">🎼 Stress & Rhythm - All Attempts</h2>
            <div className="space-y-2">
              {report.categories.stress_rhythm.items.map((item, idx) => (
                <div key={idx} className={`p-4 rounded-xl border-2 ${getStatusColor(item.status)}`}>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="font-bold text-lg">{item.name}</span>
                    <div className="flex gap-4 items-center">
                      <span className="text-sm opacity-75">{item.attempts} attempts</span>
                      <span className="text-2xl font-black">{item.score}%</span>
                      <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase">{item.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Qualitative Notes */}
        <div className="bg-gradient-to-br from-gray-900/80 to-slate-900/80 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-700/50">
          <h2 className="text-2xl font-bold mb-4 text-cyan-300">💭 Analysis Notes</h2>
          <p className="text-gray-300 leading-relaxed whitespace-pre-line">{report.qualitative_notes}</p>
        </div>

        {/* Next Session Recommendations */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-indigo-500/30">
          <h2 className="text-2xl font-bold mb-4 text-indigo-300">🎯 Next Session Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/50 rounded-xl p-4 border border-blue-500/30">
              <p className="text-sm text-gray-400 mb-2">Primary Focus</p>
              <p className="font-bold text-blue-400">{report.next_session_recommendation.primary_focus}</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-500/30">
              <p className="text-sm text-gray-400 mb-2">Secondary Focus</p>
              <p className="font-bold text-purple-400">{report.next_session_recommendation.secondary_focus}</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 border border-green-500/30">
              <p className="text-sm text-gray-400 mb-2">Warmup Topic</p>
              <p className="font-bold text-green-400">{report.next_session_recommendation.warmup_topic}</p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center pt-4">
          <Link href="/" className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl text-xl font-black transition-all transform hover:scale-105 shadow-lg">
            Start Next Session
          </Link>
        </div>
      </div>
    </div>
  );
}
