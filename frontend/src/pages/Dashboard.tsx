import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Send, RefreshCw, Sliders, LogOut, Plus, Search, X, CheckCircle, AlertTriangle, Calendar, Info, Copy, Check, BarChart3, ArrowRight } from 'lucide-react';
import JobsTable from '../components/JobsTable';
import ComposeModal from '../components/ComposeModal';
import { api } from '../api';
import type { EmailJob, Pagination, StatsResponse } from '../types';
import { useAuth } from '../context/AuthContext';

type Tab = 'overview' | 'scheduled' | 'sent';

function formatDetailDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

interface AttachmentInfo {
  name: string;
  size: string;
  dataUrl: string;
}

function parseAttachmentsFromBody(html?: string): AttachmentInfo[] {
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgs = doc.querySelectorAll('.email-attachment-file');
  
  const attachmentsList: AttachmentInfo[] = [];
  imgs.forEach((img, idx) => {
    const src = img.getAttribute('src') || '';
    if (!src) return;
    const name = img.getAttribute('data-filename') || `Attachment_Image_${idx + 1}.png`;
    const size = img.getAttribute('data-filesize') || '1.2 MB';
    if (!attachmentsList.some(att => att.dataUrl === src)) {
      attachmentsList.push({ name, size, dataUrl: src });
    }
  });
  return attachmentsList;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [composeOpen, setComposeOpen] = useState(false);

  // Draggable split pane state (LeetCode-style resizer)
  const [splitWidth, setSplitWidth] = useState(440);
  const isDragging = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !splitContainerRef.current) return;
      const containerRect = splitContainerRef.current.getBoundingClientRect();
      const newWidth = ev.clientX - containerRect.left;
      // Clamp between 280px and 70% of the container
      const maxWidth = containerRect.width * 0.7;
      setSplitWidth(Math.max(280, Math.min(newWidth, maxWidth)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<EmailJob | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4000);
  }, []);

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
      
      // Update selected job state dynamically if it was loaded
      setSelectedJob((prev) => {
        if (!prev || activeTab !== 'scheduled') return prev;
        const updated = data.jobs.find((j: EmailJob) => j.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      console.error('Failed to fetch scheduled jobs:', err);
    } finally {
      setLoadingScheduled(false);
    }
  }, [activeTab]);

  const fetchSent = useCallback(async (page: number) => {
    setLoadingSent(true);
    try {
      const data = await api.getSentJobs(page, 10);
      setSentJobs(data.jobs);
      setSentPagination(data.pagination);

      // Update selected job state dynamically if it was loaded
      setSelectedJob((prev) => {
        if (!prev || activeTab !== 'sent') return prev;
        const updated = data.jobs.find((j: EmailJob) => j.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      console.error('Failed to fetch sent jobs:', err);
    } finally {
      setLoadingSent(false);
    }
  }, [activeTab]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  const refreshSelectedJobDetails = useCallback(async (jobId: string) => {
    try {
      const data = await api.getJobDetails(jobId);
      setSelectedJob(data);
    } catch (err) {
      console.error('Failed to refresh selected job details:', err);
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchScheduled(scheduledPage);
    fetchSent(sentPage);
    fetchStats();
    if (selectedJob) {
      refreshSelectedJobDetails(selectedJob.id);
    }

    const interval = setInterval(() => {
      fetchScheduled(scheduledPage);
      fetchSent(sentPage);
      fetchStats();
      if (selectedJob) {
        refreshSelectedJobDetails(selectedJob.id);
      }
    }, 15000); // Refresh every 15s

    return () => clearInterval(interval);
  }, [fetchScheduled, fetchSent, fetchStats, refreshSelectedJobDetails, selectedJob?.id, scheduledPage, sentPage]);

  const handleScheduledPageChange = (page: number) => {
    setScheduledPage(page);
    fetchScheduled(page);
  };

  const handleSentPageChange = (page: number) => {
    setSentPage(page);
    fetchSent(page);
  };

  const handleComposeSuccess = (leadsCount?: number) => {
    setComposeOpen(false);
    showToast(
      `Campaign scheduled successfully! ${leadsCount && leadsCount > 0 ? `${leadsCount} leads queued.` : ''}`,
      'success'
    );
    setTimeout(() => {
      fetchScheduled(1);
      fetchStats();
    }, 500);
  };

  const handleRefresh = () => {
    fetchScheduled(scheduledPage);
    fetchSent(sentPage);
    fetchStats();
    if (selectedJob) {
      refreshSelectedJobDetails(selectedJob.id);
    }
  };

  // Filter jobs based on search query and status filter
  const filteredScheduledJobs = scheduledJobs.filter((job) => {
    const matchesSearch = job.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          job.subject.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return job.status === 'PENDING' || job.status === 'SCHEDULED';
    if (statusFilter === 'rate_limited') return job.status === 'RATE_LIMITED';
    if (statusFilter === 'sent') return job.status === 'SENT';
    if (statusFilter === 'failed') return job.status === 'FAILED';
    return true;
  });

  const filteredSentJobs = sentJobs.filter((job) => {
    const matchesSearch = job.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          job.subject.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return job.status === 'PENDING' || job.status === 'SCHEDULED';
    if (statusFilter === 'rate_limited') return job.status === 'RATE_LIMITED';
    if (statusFilter === 'sent') return job.status === 'SENT';
    if (statusFilter === 'failed') return job.status === 'FAILED';
    return true;
  });



  const totalScheduledCount = (stats.PENDING ?? 0) + (stats.SCHEDULED ?? 0) + (stats.RATE_LIMITED ?? 0);
  const totalSentCount = (stats.SENT ?? 0) + (stats.FAILED ?? 0);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-800 font-sans select-none">
      {/* 1. Left Sidebar Navigation Panel */}
      <aside className="w-64 bg-[#FCFCFD] border-r border-slate-100 flex flex-col p-5 shrink-0 select-none">
        {/* Brand Logo "ReachInbox" */}
        <div className="h-10 flex items-center mb-6 px-1 gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <span className="text-white text-xs font-black">R</span>
          </div>
          <span className="text-base font-extrabold text-slate-800 tracking-tight font-sans">
            ReachInbox
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
          onClick={() => {
            setComposeOpen(true);
            setSelectedJob(null);
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-[#4CAF50] text-[#4CAF50] hover:bg-emerald-50 transition-all font-semibold text-sm mb-8 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Compose
        </button>

        {/* Navigation Tabs */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => {
              setActiveTab('overview');
              setSelectedJob(null);
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'overview' && !composeOpen
                ? 'bg-emerald-50 text-[#2E7D32]'
                : 'text-[#5F6368] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4" />
              <span>Overview</span>
            </div>
          </button>

          <button
            onClick={() => {
              setActiveTab('scheduled');
              setSelectedJob(null);
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
              setSelectedJob(null);
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
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative">
        {composeOpen ? (
          /* Render Compose Screen Full Width */
          <ComposeModal
            isOpen={true}
            onClose={() => setComposeOpen(false)}
            onSuccess={handleComposeSuccess}
          />
        ) : activeTab === 'overview' ? (
          /* Overview View (Summary Analytics Dashboard) */
          <div className="flex-1 flex flex-col h-full bg-[#FCFCFD]/50 overflow-y-auto p-8 font-sans">
            {/* Welcome banner */}
            <div className="mb-8 animate-fade-in">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard Overview</h1>
              <p className="text-sm text-slate-400 mt-1">Welcome back! Here is a summary of your ReachInbox email campaigns.</p>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 animate-fade-in">
              {/* Scheduled Card */}
              <div className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Queue</span>
                  <p className="text-2xl font-black text-slate-800 mt-1">{totalScheduledCount}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#2E7D32]">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              {/* Sent Card */}
              <div className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivered</span>
                  <p className="text-2xl font-black text-slate-800 mt-1">{stats.SENT ?? 0}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Send className="w-5 h-5" />
                </div>
              </div>

              {/* Failed Card */}
              <div className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Failed Logs</span>
                  <p className="text-2xl font-black text-slate-800 mt-1">{stats.FAILED ?? 0}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              {/* Rate Limited Card */}
              <div className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rate Limited</span>
                  <p className="text-2xl font-black text-slate-800 mt-1">{stats.RATE_LIMITED ?? 0}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <Info className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Split: Efficiency & Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-fade-in">
              {/* Delivery Efficiency Progress Card */}
              <div className="lg:col-span-2 p-6 border border-slate-100 rounded-2xl shadow-sm bg-white flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Efficiency</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-slate-800">
                      {totalSentCount > 0 ? Math.round(((stats.SENT ?? 0) / totalSentCount) * 100) : 100}%
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">success rate</span>
                  </div>
                </div>
                
                {/* Progress bar visual */}
                <div className="mt-6">
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${totalSentCount > 0 ? Math.round(((stats.SENT ?? 0) / totalSentCount) * 100) : 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mt-2">
                    <span>{stats.SENT ?? 0} Delivered</span>
                    <span>{stats.FAILED ?? 0} Failed</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="p-6 border border-slate-100 rounded-2xl shadow-sm bg-white flex flex-col justify-between gap-6">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</span>
                  <p className="text-xs text-slate-400 mt-1">Direct controls to manage campaigns.</p>
                </div>
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setComposeOpen(true);
                      setSelectedJob(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-xs shadow-md shadow-emerald-500/10 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Compose Campaign
                  </button>
                  
                  <button
                    onClick={() => {
                      setActiveTab('scheduled');
                      setComposeOpen(false);
                      setSelectedJob(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors"
                  >
                    <span>View Scheduled Queue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Logs Stream */}
            <div className="p-6 border border-slate-100 rounded-2xl shadow-sm bg-white flex-grow flex flex-col animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Campaign Activity</span>
                <button
                  onClick={handleRefresh}
                  className="text-xs text-[#2E7D32] hover:underline font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingScheduled || loadingSent ? 'animate-spin' : ''}`} />
                  Refresh Logs
                </button>
              </div>

              {/* Activity List */}
              <div className="flex flex-col gap-3 flex-grow justify-start">
                {(() => {
                  const merged = [...scheduledJobs, ...sentJobs]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 3);
                  
                  if (merged.length === 0) {
                    return (
                      <div className="text-center py-10 text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                        <Send className="w-6 h-6 text-slate-200" />
                        No recent activity found. Scheduled email campaigns will list here.
                      </div>
                    );
                  }

                  return merged.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3.5 bg-[#FCFCFD]/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          job.status === 'SENT' ? 'bg-[#E8F5E9] text-[#2E7D32]' :
                          job.status === 'FAILED' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {job.recipient.charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{job.recipient}</p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{job.subject}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                          job.status === 'SENT' ? 'bg-[#E8F5E9] text-[#2E7D32]' :
                          job.status === 'FAILED' ? 'bg-red-100/50 text-red-600' :
                          'bg-amber-100/50 text-amber-700'
                        }`}>
                          {job.status}
                        </span>
                        
                        <span className="text-[9px] text-slate-400 font-semibold">
                          {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        ) : (
          /* Split View Layout (Email Lists on Left, Selected details on Right) */
          <div ref={splitContainerRef} className="flex-1 flex h-full overflow-hidden">
            
            {/* 2.1 Lists pane */}
            <div
              className="flex flex-col border-r border-slate-100 h-full overflow-hidden shrink-0"
              style={{ width: selectedJob ? `${splitWidth}px` : '100%' }}
            >
              
              {/* Top Toolbar (Search, Filter, Refresh) */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                {/* Search Bar Container */}
                <div className="relative flex-1 max-w-xs">
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
                <div className="flex items-center gap-3 pl-3 relative">
                  <button
                    onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                    title="Filter by Status"
                    className={`p-2 border rounded-lg transition-colors ${statusFilter !== 'all' ? 'text-[#2E7D32] border-emerald-200 bg-emerald-50' : 'text-slate-400 hover:text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    <Sliders className="w-4 h-4" />
                  </button>

                  {/* Filter Dropdown Popover */}
                  {filterDropdownOpen && (
                    <div className="absolute right-0 top-11 w-48 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-20 animate-fade-in font-sans">
                      <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Filter by Status</div>
                      
                      <button
                        onClick={() => { setStatusFilter('all'); setFilterDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${statusFilter === 'all' ? 'text-[#2E7D32] bg-emerald-50 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>Show All</span>
                        {statusFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#2E7D32]" />}
                      </button>

                      <button
                        onClick={() => { setStatusFilter('pending'); setFilterDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${statusFilter === 'pending' ? 'text-[#2E7D32] bg-emerald-50 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>Scheduled / Pending</span>
                        {statusFilter === 'pending' && <Check className="w-3.5 h-3.5 text-[#2E7D32]" />}
                      </button>

                      <button
                        onClick={() => { setStatusFilter('sent'); setFilterDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${statusFilter === 'sent' ? 'text-[#2E7D32] bg-emerald-50 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>Sent</span>
                        {statusFilter === 'sent' && <Check className="w-3.5 h-3.5 text-[#2E7D32]" />}
                      </button>

                      <button
                        onClick={() => { setStatusFilter('failed'); setFilterDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${statusFilter === 'failed' ? 'text-[#2E7D32] bg-emerald-50 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>Failed</span>
                        {statusFilter === 'failed' && <Check className="w-3.5 h-3.5 text-[#2E7D32]" />}
                      </button>

                      <button
                        onClick={() => { setStatusFilter('rate_limited'); setFilterDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${statusFilter === 'rate_limited' ? 'text-[#2E7D32] bg-emerald-50 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>Rate Limited</span>
                        {statusFilter === 'rate_limited' && <Check className="w-3.5 h-3.5 text-[#2E7D32]" />}
                      </button>
                    </div>
                  )}

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
                    onSelectJob={setSelectedJob}
                    selectedJobId={selectedJob?.id}
                  />
                ) : (
                  <JobsTable
                    jobs={filteredSentJobs}
                    loading={loadingSent}
                    pagination={sentPagination}
                    onPageChange={handleSentPageChange}
                    type="sent"
                    onSelectJob={setSelectedJob}
                    selectedJobId={selectedJob?.id}
                  />
                )}
              </div>
            </div>

            {/* Draggable Resizer Handle (LeetCode-style) */}
            {selectedJob && (
              <div
                onMouseDown={handleMouseDown}
                className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-emerald-400/40 active:bg-emerald-500/50 transition-colors relative group z-10"
                title="Drag to resize"
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-slate-300 group-hover:bg-emerald-500 transition-colors" />
              </div>
            )}

            {/* 2.2 Thread Details Pane (Matches Onebox/Gmail email detail panel) */}
            {selectedJob ? (
              <div className="flex-1 bg-[#FAFAFA] flex flex-col h-full overflow-y-auto p-8 gap-6 animate-fade-in font-sans">
                {/* Header Action Row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wider">
                    {selectedJob.status}
                  </span>
                  
                  <button
                    onClick={() => setSelectedJob(null)}
                    title="Close Details"
                    className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Email Subject Line */}
                <div>
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight leading-snug">
                    {selectedJob.subject}
                  </h2>
                </div>

                {/* Sender & Recipient profile details */}
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-violet-50 border border-slate-100 flex items-center justify-center font-bold text-blue-600 text-sm">
                    {selectedJob.senderName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {selectedJob.senderName}
                      <span className="text-xs font-normal text-slate-400 ml-1.5">
                        &lt;{selectedJob.sender}&gt;
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      To: {selectedJob.recipient}
                    </p>
                  </div>
                </div>

                {/* Delivery status banners */}
                {selectedJob.status === 'SENT' && (
                  <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-sm leading-relaxed">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-900">Successfully Delivered</p>
                      <p className="text-xs text-emerald-700/80 mt-0.5">The email was sent successfully through your SMTP provider.</p>
                    </div>
                  </div>
                )}

                {selectedJob.status === 'FAILED' && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-sm leading-relaxed">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900">Delivery Failure</p>
                      <p className="text-xs text-red-600 mt-1 font-mono bg-white/60 p-2 rounded border border-red-200/50 break-words">
                        {selectedJob.error || 'Unknown transporter error.'}
                      </p>
                    </div>
                  </div>
                )}

                {selectedJob.status === 'RATE_LIMITED' && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-sm leading-relaxed">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900">Rate Limited</p>
                      <p className="text-xs text-amber-700/80 mt-0.5">
                        Hourly campaign email limits exceeded for this sender. Job rescheduled for the next UTC hour window automatically.
                      </p>
                    </div>
                  </div>
                )}

                {/* Full Body Content Box */}
                <div className="flex-1 flex flex-col min-h-[220px]">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Message Body</span>
                  <div
                    className="flex-1 bg-white border border-slate-100 rounded-xl p-6 shadow-sm text-sm text-slate-700 leading-relaxed font-sans overflow-auto select-text select-all"
                    dangerouslySetInnerHTML={{ __html: selectedJob.body ? selectedJob.body.replace(/<img[^>]*class="email-attachment-file"[^>]*>/g, '') : 'No message content' }}
                  />
                </div>

                {/* Render extracted attachments at the bottom */}
                {(() => {
                  const extracted = parseAttachmentsFromBody(selectedJob.body);
                  if (extracted.length === 0) return null;
                  return (
                    <div className="flex flex-col gap-2 animate-fade-in">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Attachments ({extracted.length})</span>
                      <div className="flex flex-wrap gap-4">
                        {extracted.map((att, idx) => (
                          <div key={idx} className="w-40 border border-slate-200 bg-slate-50/50 rounded-xl overflow-hidden shadow-sm flex flex-col">
                            <img src={att.dataUrl} alt={att.name} className="h-20 w-full object-cover bg-slate-100" />
                            <div className="p-2 bg-white flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-slate-800 truncate" title={att.name}>{att.name}</span>
                              <span className="text-[9px] text-slate-400 font-semibold">{att.size}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Job Info Grid metadata */}
                <div className="flex flex-col gap-3">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Campaign Metrics</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Scheduled At</p>
                      <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDetailDate(selectedJob.scheduledAt)}
                      </p>
                    </div>

                    <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Executed At</p>
                      <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                        {selectedJob.sentAt ? formatDetailDate(selectedJob.sentAt) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Copyable Job ID row */}
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Job ID</p>
                      <p className="text-xs font-mono text-slate-600 mt-1 select-all">{selectedJob.id}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedJob.id)}
                      title="Copy Job ID"
                      className="p-1.5 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* No selection placeholder panel (Matches Figma blank details background) */
              <div className="flex-grow bg-[#FAFAFA] flex items-center justify-center text-slate-400 text-sm font-medium border-l border-slate-100 select-none">
                <div className="flex flex-col items-center gap-2">
                  <Send className="w-8 h-8 text-slate-300" />
                  <p>Select an email thread from the list to read its logs</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast Notification Popover */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border text-sm font-semibold font-sans animate-slide-up z-50 transition-all ${toast.type === 'success' ? 'bg-[#E8F5E9] border-emerald-100 text-[#2E7D32]' : 'bg-red-50 border-red-100 text-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4.5 h-4.5 text-[#2E7D32]" /> : <AlertTriangle className="w-4.5 h-4.5 text-red-600" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
