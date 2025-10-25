import React from 'react';

interface RiskBadgeProps {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  score?: number;
  className?: string;
}

const COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700 border-green-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',
};

export function RiskBadge({ level, score, className = '' }: RiskBadgeProps) {
  const normalized = level.toUpperCase();
  const color = COLORS[normalized] || 'bg-gray-100 text-gray-700 border-gray-300';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${color} ${className}`}> 
      {normalized}
      {typeof score === 'number' && (
        <span className="opacity-70">({score})</span>
      )}
    </span>
  );
}
