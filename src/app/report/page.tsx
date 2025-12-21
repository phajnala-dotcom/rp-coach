'use client';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/types';
import Link from 'next/link';

export default function ReportPage() {
  const [report, setReport] = useState<any | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const reportStr = localStorage.getItem(STORAGE_KEYS.LAST_SESSION_REPORT);
      if (reportStr) {
        try {
          const parsedReport = JSON.parse(reportStr);
          console.log('📊 Full Report Data:', parsedReport);
          setReport(parsedReport);
        } catch (e) {
          console.error('Error parsing report:', e);
        }
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

  // Format date
  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 md:p-16">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            ← Back to Home
          </Link>
        </div>

        {/* Report Content */}
        <div className="space-y-12">
          
          {/* Time & Date */}
          {report.timestamp && (
            <div>
              <h2 className="text-lg font-bold mb-3">TIME & DATE:</h2>
              <p className="text-base">{formatDate(report.timestamp)}</p>
              <div className="h-6"></div>
            </div>
          )}

          {/* Empty row */}
          <div className="h-4"></div>

          {/* Proficiency Scores */}
          {report.scores && (
            <div>
              <h2 className="text-lg font-bold mb-3">PROFICIENCY SCORES</h2>
              <div className="space-y-2 text-base">
                {report.scores.overall !== undefined && (
                  <p className="font-bold">Overall: {report.scores.overall}%</p>
                )}
                {report.scores.phonetics !== undefined && (
                  <p>Phonetics: {report.scores.phonetics}%</p>
                )}
                {report.scores.intonation !== undefined && (
                  <p>Intonation: {report.scores.intonation}%</p>
                )}
                {report.scores.stress !== undefined && (
                  <p>Stress: {report.scores.stress}%</p>
                )}
              </div>
            </div>
          )}

          {/* Empty row */}
          <div className="h-4"></div>

          {/* Qualitative Evaluation */}
          {(report.qualitative_evaluation || report.qualitative_notes) && (
            <div>
              <h2 className="text-lg font-bold mb-3">QUALITATIVE EVALUATION</h2>
              <p className="text-base leading-relaxed whitespace-pre-line">
                {report.qualitative_evaluation || report.qualitative_notes}
              </p>
            </div>
          )}

          {/* Focus Phonemes */}
          {report.focus_phonemes && report.focus_phonemes.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">FOCUS PHONEMES</h2>
              <ul className="list-disc list-inside text-base space-y-1">
                {report.focus_phonemes.map((phoneme: string, idx: number) => (
                  <li key={idx}>{phoneme}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Exercise Types */}
          {report.exercise_types && report.exercise_types.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">EXERCISE TYPES</h2>
              <ul className="list-disc list-inside text-base space-y-1">
                {report.exercise_types.map((exercise: string, idx: number) => (
                  <li key={idx}>{exercise}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Priority Areas */}
          {report.priority_areas && report.priority_areas.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">PRIORITY AREAS</h2>
              <ul className="list-disc list-inside text-base space-y-1">
                {report.priority_areas.map((area: string, idx: number) => (
                  <li key={idx}>{area}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
