'use client';

import { TrainingDay, SPORT_ICONS, SPORT_COLORS, HEART_RATE_ZONES } from '@/lib/types';
import { formatDuration } from '@/lib/schedule';

interface TrainingCardProps {
  training: TrainingDay;
  isToday?: boolean;
  compact?: boolean;
}

export default function TrainingCard({ training, isToday = false, compact = false }: TrainingCardProps) {
  return (
    <div
      className={`rounded-xl p-4 transition-all ${
        isToday
          ? 'bg-blue-50 border-2 border-blue-500 shadow-md'
          : 'bg-white border border-gray-200'
      } ${compact ? '' : 'shadow-sm'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
            {training.day}
          </span>
          {isToday && (
            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
              Vandaag
            </span>
          )}
        </div>
        {training.isRestDay && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            Rustdag
          </span>
        )}
      </div>

      <div className="space-y-2">
        {training.sessions.map((session, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                SPORT_COLORS[session.sport]
              } text-white flex-shrink-0`}
            >
              {SPORT_ICONS[session.sport]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {session.durationMinutes && (
                  <span className="text-xs text-gray-500">
                    {formatDuration(session.durationMinutes)}
                  </span>
                )}
                {session.zone && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium text-white"
                    style={{
                      backgroundColor:
                        HEART_RATE_ZONES.find((z) => z.zone === session.zone)?.color ?? '#888',
                    }}
                  >
                    {session.zone}{' '}
                    ({HEART_RATE_ZONES.find((z) => z.zone === session.zone)?.min}–
                    {HEART_RATE_ZONES.find((z) => z.zone === session.zone)?.max} bpm)
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
