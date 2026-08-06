import React from 'react';
import { ChevronLeft, ChevronRight, Mail, Clock, Send } from 'lucide-react';
import type { EmailJob, Pagination } from '../types';
import StatusBadge from './StatusBadge';

interface JobsTableProps {
  jobs: EmailJob[];
  loading: boolean;
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
  type: 'scheduled' | 'sent';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// Skeleton row for loading state
const SkeletonRow: React.FC = () => (
  <tr className="border-b border-white/5">
    {[1, 2, 3, 4, 5].map((i) => (
      <td key={i} className="px-5 py-4">
        <div className="h-4 bg-white/5 rounded-md animate-pulse" style={{ width: `${40 + i * 10}%` }} />
      </td>
    ))}
  </tr>
);

// Empty state display
const EmptyState: React.FC<{ type: 'scheduled' | 'sent' }> = ({ type }) => (
  <tr>
    <td colSpan={5} className="px-5 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
          {type === 'scheduled' ? (
            <Clock className="w-6 h-6 text-slate-500" />
          ) : (
            <Send className="w-6 h-6 text-slate-500" />
          )}
        </div>
        <p className="text-slate-400 font-medium">
          {type === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
        </p>
        <p className="text-slate-600 text-sm">
          {type === 'scheduled'
            ? 'Schedule a campaign to see emails here.'
            : 'Emails will appear here once sent.'}
        </p>
      </div>
    </td>
  </tr>
);

const JobsTable: React.FC<JobsTableProps> = ({ jobs, loading, pagination, onPageChange, type }) => {
  const isScheduled = type === 'scheduled';

  return (
    <div className="flex flex-col gap-4">
      {/* Table */}
      <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Recipient</div>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Sender</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {isScheduled ? 'Scheduled At' : 'Sent At'}
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : jobs.length === 0 ? (
                <EmptyState type={type} />
              ) : (
                jobs.map((job, idx) => (
                  <tr
                    key={job.id}
                    className={`border-b border-white/5 hover:bg-white/3 transition-colors duration-150 ${
                      idx % 2 === 0 ? '' : 'bg-white/1'
                    }`}
                  >
                    <td className="px-5 py-4">
                      <span className="text-slate-200 font-medium truncate max-w-[180px] block">
                        {job.recipient}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 truncate max-w-[200px] block">{job.subject}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-400 text-xs truncate max-w-[160px] block">
                        {job.senderName} <br />
                        <span className="text-slate-600">{job.sender}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                      {isScheduled ? formatDate(job.scheduledAt) : formatDate(job.sentAt)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-slate-500 text-sm">
            Showing {((pagination.page - 1) * pagination.limit) + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              id="prev-page-btn"
              className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 text-sm text-slate-300">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              id="next-page-btn"
              className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsTable;
