import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Send, RefreshCw, Sliders, ChevronDown, LogOut, Plus, Search } from 'lucide-react';
import JobsTable from '../components/JobsTable';
import ComposeModal from '../components/ComposeModal';
import { api } from '../api';
import type { EmailJob, Pagination, StatsResponse } from '../types';
import { useAuth } from '../context/AuthContext';

type Tab = 'scheduled' | 'sent';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter jobs based on search query
  const filteredScheduledJobs = scheduledJobs.filter((job) =>
    job.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSentJobs = sentJobs.filter((job) =>
    job.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalScheduledCount = (stats.PENDING ?? 0) + (stats.SCHEDULED ?? 0) + (stats.RATE_LIMITED ?? 0);
  const totalSentCount = (stats.SENT ?? 0) + (stats.FAILED ?? 0);

  return (
    <div className="flex min-h-screen bg-white text-slate-800 font-sans select-none">
      {/* 1. Left Sidebar Navigation Panel */}
      <aside className="w-64 bg-[#FCFCFD] border-r border-slate-100 flex flex-col p-5 shrink-0 select-none">
        {/* Brand Logo "ONE" */}
        <div className="h-10 flex items-center mb-6 px-1">
          <span className="text-xl font-black text-black tracking-widest font-mono">
            ONE
          </span>
        </div>

        {/* Active User Card with Dropdown Arrow & Logout */}
        {user && (
          <div className="group relative flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white shadow-sm mb-6">
            <div className="flex items-center gap-3 min-w-0">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full ring-2 ring-slate-100" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
              </div>
            </div>
            
            {/* Logout Popup/Button */}
            <button
              onClick={logout}
              title="Logout"
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Compose Button */}
        <button
          onClick={() => setComposeOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-[#4CAF50] text-[#4CAF50] hover:bg-emerald-50 transition-all font-semibold text-sm mb-8 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Compose
        </button>

        {/* Core Menu Label */}
        <div className="px-2 mb-2">
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">CORE</span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => {
              setActiveTab('scheduled');
              setComposeOpen(false);
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'scheduled' && !composeOpen
                ? 'bg-emerald-50 text-[#2E7D32]'
                : 'text-[#5F6368] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4" />
              <span>Scheduled</span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100/50">
              {totalScheduledCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('sent');
              setComposeOpen(false);
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'sent' && !composeOpen
                ? 'bg-emerald-50 text-[#2E7D32]'
                : 'text-[#5F6368] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Send className="w-4 h-4" />
              <span>Sent</span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100/50">
              {totalSentCount}
            </span>
          </button>
        </div>
      </aside>

      {/* 2. Right Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {composeOpen ? (
          /* Render Compose Screen Full Width */
          <ComposeModal
            isOpen={true}
            onClose={() => setComposeOpen(false)}
            onSuccess={handleComposeSuccess}
          />
        ) : (
          /* Render Scheduled/Sent List View */
          <div className="flex-1 flex flex-col">
            {/* Top Toolbar (Search, Filter, Refresh) */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100">
              {/* Search Bar Container */}
              <div className="relative w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-full text-sm bg-slate-50/50 focus:outline-none focus:border-slate-300 transition-colors"
                />
              </div>

              {/* Toolbar Controls */}
              <div className="flex items-center gap-3">
                <button
                  title="Filter"
                  className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Sliders className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRefresh}
                  title="Refresh"
                  className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingScheduled || loadingSent ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* List Table of Items */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'scheduled' ? (
                <JobsTable
                  jobs={filteredScheduledJobs}
                  loading={loadingScheduled}
                  pagination={scheduledPagination}
                  onPageChange={handleScheduledPageChange}
                  type="scheduled"
                />
              ) : (
                <JobsTable
                  jobs={filteredSentJobs}
                  loading={loadingSent}
                  pagination={sentPagination}
                  onPageChange={handleSentPageChange}
                  type="sent"
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
