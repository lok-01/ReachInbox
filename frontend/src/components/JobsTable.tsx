import { ChevronLeft, ChevronRight, Star, Mail } from 'lucide-react';
import type { EmailJob, Pagination } from '../types';

interface JobsTableProps {
  jobs: EmailJob[];
  loading: boolean;
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
  type: 'scheduled' | 'sent';
  onSelectJob?: (job: EmailJob) => void;
  selectedJobId?: string;
}

function formatFigmaDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[d.getDay()];
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return `${dayName} ${timeStr}`;
}

const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  loading,
  pagination,
  onPageChange,
  type,
  onSelectJob,
  selectedJobId,
}) => {
  return (
    <div className="flex flex-col gap-4 font-sans bg-white select-none">
      {/* List Container */}
      <div className="flex flex-col border-t border-b border-slate-100">
        {loading && jobs.length === 0 ? (
          // Skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-5 px-6 border-b border-slate-50 animate-pulse">
              <div className="flex items-center gap-6 flex-1">
                <div className="w-24 h-4 bg-slate-100 rounded-md" />
                <div className="w-20 h-5 bg-slate-100 rounded-full" />
                <div className="w-1/2 h-4 bg-slate-100 rounded-md" />
              </div>
              <div className="w-5 h-5 bg-slate-100 rounded-full" />
            </div>
          ))
        ) : jobs.length === 0 ? (
          // Empty State Mockup
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100/50 flex items-center justify-center text-slate-300 mb-4 shadow-sm shadow-slate-100/20">
              <Mail className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">No campaigns found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[260px] leading-relaxed">
              {type === 'scheduled' 
                ? 'Your scheduled queues are empty. Click "Compose" to schedule a new email campaign.'
                : 'You have not sent any emails yet. Once scheduled campaigns are processed, they will appear here.'}
            </p>
          </div>
        ) : (
          jobs.map((job) => {
            const isScheduled = type === 'scheduled';
            const isSelected = selectedJobId === job.id;
            return (
              <div
                key={job.id}
                onClick={() => onSelectJob?.(job)}
                className={`flex items-center justify-between py-4 px-6 border-b border-slate-100 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#F4FBF7] border-l-4 border-emerald-500 pl-[20px]'
                    : 'hover:bg-slate-50/50'
                }`}
              >
                {/* Left & Middle Info */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                  {/* Recipient */}
                  <div className="w-32 shrink-0 font-medium text-slate-800 text-sm truncate">
                    To: {job.recipient.split('@')[0]}
                  </div>

                  {/* Status / Date Badge */}
                  <div className="shrink-0 flex items-center">
                    {isScheduled ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFF3E0] text-[#E65100]">
                        {formatFigmaDate(job.scheduledAt)}
                      </span>
                    ) : job.status === 'FAILED' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                        Failed
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8F5E9] text-[#2E7D32]">
                        Sent
                      </span>
                    )}
                  </div>

                  {/* Subject + Body Snippet */}
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-semibold text-slate-800">{job.subject}</span>
                    <span className="text-slate-400 font-normal truncate">
                      {' — '}{(job.body || '').replace(/<[^>]*>/g, '') || (job.error ? `Error: ${job.error}` : 'No content')}
                    </span>
                  </div>
                </div>

                {/* Right Star Action */}
                <div className="shrink-0 pl-4">
                  <button className={`transition-colors ${isSelected ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}>
                    <Star className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-2">
          <p className="text-slate-400 text-xs">
            Showing {((pagination.page - 1) * pagination.limit) + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 py-1 text-xs text-slate-500">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
