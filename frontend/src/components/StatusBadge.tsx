import React from 'react';
import type { JobStatus } from '../types';

interface StatusBadgeProps {
  status: JobStatus;
}

const config: Record<JobStatus, { label: string; classes: string; dot: string }> = {
  PENDING: {
    label: 'Pending',
    classes: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-400',
  },
  SCHEDULED: {
    label: 'Scheduled',
    classes: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dot: 'bg-blue-400',
  },
  SENT: {
    label: 'Sent',
    classes: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  FAILED: {
    label: 'Failed',
    classes: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-400',
  },
  RATE_LIMITED: {
    label: 'Rate Limited',
    classes: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
    dot: 'bg-violet-400',
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { label, classes, dot } = config[status] ?? config.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
};

export default StatusBadge;
