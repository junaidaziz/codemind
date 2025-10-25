import React from 'react';

export function ReviewStatusChip({ approved, requiresChanges }: { approved: boolean; requiresChanges: boolean }) {
  const label = requiresChanges ? 'Needs Changes' : approved ? 'Approved' : 'Review';
  const style = requiresChanges
    ? 'bg-red-50 text-red-700 border-red-300'
    : approved
      ? 'bg-green-50 text-green-700 border-green-300'
      : 'bg-blue-50 text-blue-700 border-blue-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${style}`}>{label}</span>
  );
}
