import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Send, RefreshCw, TrendingUp, Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import JobsTable from '../components/JobsTable';
import ComposeModal from '../components/ComposeModal';
import { api } from '../api';
import type { EmailJob, Pagination, StatsResponse } from '../types';

type Tab = 'scheduled' | 'sent';

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <div className={`flex items-center gap-3 p-4 rounded-xl border ${color} bg-white/3 backdrop-blur-sm`}>
    <div className="p-2 rounded-lg bg-white/5">{icon}</div>
    <div>
      <p className="text-2xl font-bold text-slate-100">{value ?? 0}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);

  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [scheduledPagination, setScheduledPagination] = useState<Pagination | null>(null);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);
  const [sentPagination, setSentPagination] = useState<Pagination | null>(null);
  const [sentPage, setSentPage] = useState(1);
  const [loadingSent, setLoadingSent] = useState(false);

  const [stats, setStats] = useState<StatsResponse>({});

  const fetchScheduled = useCallback(async (page: number) => {
    setLoadingScheduled(true);
    try {
      const data = await api.getScheduledJobs(page, 10);
      setScheduledJobs(data.jobs);
      setScheduledPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch scheduled jobs:', err);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  const fetchSent = useCallback(async (page: number) => {
    setLoadingSent(true);
    try {
      const data = await api.getSentJobs(page, 10);
      setSentJobs(data.jobs);
      setSentPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch sent jobs:', err);
    } finally {
      setLoadingSent(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchScheduled(scheduledPage);
    fetchSent(sentPage);
    fetchStats();

    const interval = setInterval(() => {
      fetchScheduled(scheduledPage);
      fetchSent(sentPage);
      fetchStats();
    }, 15000); // Refresh every 15s

    return () => clearInterval(interval);
  }, [fetchScheduled, fetchSent, fetchStats, scheduledPage, sentPage]);

  const handleScheduledPageChange = (page: number) => {
    setScheduledPage(page);
    fetchScheduled(page);
  };

  const handleSentPageChange = (page: number) => {
    setSentPage(page);
    fetchSent(page);
  };

  const handleComposeSuccess = () => {
    setTimeout(() => {
      fetchScheduled(1);
      fetchStats();
    }, 500);
  };

  const handleRefresh = () => {
    fetchScheduled(scheduledPage);
    fetchSent(sentPage);
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-[#0b0f19]">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-glow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-glow" style={{ animationDelay: '2s' }} />
      </div>

      <Header onCompose={() => setComposeOpen(true)} />

      <main className="relative max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Email Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Monitor and manage your email scheduling campaigns.</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Scheduled"
            value={(stats.PENDING ?? 0) + (stats.SCHEDULED ?? 0) + (stats.RATE_LIMITED ?? 0)}
            icon={<Clock className="w-4 h-4 text-blue-400" />}
            color="border-blue-500/15"
          />
          <StatCard
            label="Sent"
            value={stats.SENT}
            icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}
            color="border-emerald-500/15"
          />
          <StatCard
            label="Failed"
            value={stats.FAILED}
            icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
            color="border-red-500/15"
          />
          <StatCard
            label="Rate Limited"
            value={stats.RATE_LIMITED}
            icon={<TrendingUp className="w-4 h-4 text-violet-400" />}
            color="border-violet-500/15"
          />
        </div>

        {/* Tabs + Refresh */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/8 font-sans">
            <button
              id="tab-scheduled"
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'scheduled'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              Scheduled
              {((stats.PENDING ?? 0) + (stats.SCHEDULED ?? 0) + (stats.RATE_LIMITED ?? 0)) > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'scheduled' ? 'bg-white/20' : 'bg-white/10'}`}>
                  {(stats.PENDING ?? 0) + (stats.SCHEDULED ?? 0) + (stats.RATE_LIMITED ?? 0)}
                </span>
              )}
            </button>
            <button
              id="tab-sent"
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'sent'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="w-4 h-4" />
              Sent
              {((stats.SENT ?? 0) + (stats.FAILED ?? 0)) > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'sent' ? 'bg-white/20' : 'bg-white/10'}`}>
                  {(stats.SENT ?? 0) + (stats.FAILED ?? 0)}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={handleRefresh}
            id="refresh-btn"
            title="Refresh"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/8 border border-white/8 transition-all duration-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingScheduled || loadingSent ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Table */}
        {activeTab === 'scheduled' ? (
          <JobsTable
            jobs={scheduledJobs}
            loading={loadingScheduled}
            pagination={scheduledPagination}
            onPageChange={handleScheduledPageChange}
            type="scheduled"
          />
        ) : (
          <JobsTable
            jobs={sentJobs}
            loading={loadingSent}
            pagination={sentPagination}
            onPageChange={handleSentPageChange}
            type="sent"
          />
        )}

        {/* Empty action hint */}
        {!loadingScheduled && scheduledJobs.length === 0 && activeTab === 'scheduled' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setComposeOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-600/30 transition-all duration-200"
            >
              <Mail className="w-4 h-4" />
              Schedule your first campaign
            </button>
          </div>
        )}
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={handleComposeSuccess}
      />
    </div>
  );
};

export default Dashboard;
