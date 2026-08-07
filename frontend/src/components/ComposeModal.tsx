import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Paperclip, Clock, Upload, Loader2, ChevronDown, Check, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { Sender } from '../types';
import { useAuth } from '../context/AuthContext';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  subject: string;
  body: string;
  senderId: string;
  startTime: string;
  delaySeconds: string;
  hourlyLimit: string;
  manualLeads: string;
}

const DEFAULT_FORM: FormState = {
  subject: '',
  body: '',
  senderId: '',
  startTime: '',
  delaySeconds: '5',
  hourlyLimit: '100',
  manualLeads: '',
};

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [detectedEmails, setDetectedEmails] = useState<number>(0);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingEthereal, setCreatingEthereal] = useState(false);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default start time to 2 minutes from now
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 2);
      const localStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setForm((prev) => ({ ...prev, startTime: localStr }));
      fetchSenders();
    }
  }, [isOpen]);

  const fetchSenders = async () => {
    setLoadingSenders(true);
    try {
      const data = await api.getSenders();
      setSenders(data);
      if (data.length > 0) {
        setForm((prev) => ({ ...prev, senderId: data[0].id }));
      }
    } catch {
      // ignore
    } finally {
      setLoadingSenders(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected) {
      const text = await selected.text();
      const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      setDetectedEmails(new Set(emails.map((em) => em.toLowerCase())).size);
    } else {
      setDetectedEmails(0);
    }
  };

  const countManualEmails = (text: string) => {
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    return new Set(matches.map((em) => em.toLowerCase())).size;
  };

  const handleAddEtherealSender = async () => {
    setCreatingEthereal(true);
    try {
      const sender = await api.createSender({ type: 'ethereal', name: 'Test Sender' });
      setSenders((prev) => [sender, ...prev]);
      setForm((prev) => ({ ...prev, senderId: sender.id }));
    } catch {
      setError('Failed to create Ethereal test sender.');
    } finally {
      setCreatingEthereal(false);
    }
  };

  const setPresetTime = (preset: 'tomorrow_10' | 'tomorrow_11' | 'tomorrow_15' | 'tomorrow') => {
    const now = new Date();
    const target = new Date(now);
    target.setDate(now.getDate() + 1); // Tomorrow

    if (preset === 'tomorrow_10') {
      target.setHours(10, 0, 0, 0);
    } else if (preset === 'tomorrow_11') {
      target.setHours(11, 0, 0, 0);
    } else if (preset === 'tomorrow_15') {
      target.setHours(15, 0, 0, 0);
    } else {
      // default tomorrow same time
    }

    const localStr = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm((prev) => ({ ...prev, startTime: localStr }));
    setSendLaterOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!form.senderId) {
      setError('Please select or create a sender first.');
      return;
    }

    const totalLeads = file ? detectedEmails : countManualEmails(form.manualLeads);
    if (totalLeads === 0) {
      setError('No valid email addresses found. Upload a list or enter leads manually.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('senderId', form.senderId);
      formData.append('subject', form.subject);
      formData.append('body', form.body);
      formData.append('startTime', new Date(form.startTime).toISOString());
      formData.append('delaySeconds', form.delaySeconds);
      formData.append('hourlyLimit', form.hourlyLimit);
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('manualLeads', form.manualLeads);
      }

      await api.scheduleCampaign(formData);
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to schedule campaign. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm(DEFAULT_FORM);
    setFile(null);
    setDetectedEmails(0);
    setError(null);
    setSendLaterOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  const totalLeads = file ? detectedEmails : countManualEmails(form.manualLeads);
  const isScheduledLater = new Date(form.startTime).getTime() > Date.now() + 180000; // scheduled later if > 3 mins

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col font-sans border-l border-slate-100">
      {/* Top Navigation / Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={handleClose} className="p-1 text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-slate-800 text-base">Compose New Email</span>
        </div>

        <div className="flex items-center gap-4">
          <button type="button" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setSendLaterOpen(!sendLaterOpen)}
            className={`p-2 rounded-lg transition-colors ${sendLaterOpen ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Clock className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-emerald-500 text-emerald-600 text-sm font-semibold hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isScheduledLater ? (
              'Send Later'
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex relative">
        {/* Main Compose Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 gap-5 min-w-0">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* From Selector */}
          <div className="flex items-center py-2 border-b border-slate-100 gap-4">
            <span className="w-16 text-sm text-slate-400">From</span>
            <div className="flex-1 flex items-center gap-3">
              {loadingSenders ? (
                <div className="w-48 h-8 bg-slate-50 animate-pulse rounded" />
              ) : senders.length === 0 ? (
                <span className="text-xs text-amber-600">No senders found. Click "+" to generate one.</span>
              ) : (
                <div className="relative flex items-center">
                  <select
                    value={form.senderId}
                    onChange={(e) => setForm((p) => ({ ...p, senderId: e.target.value }))}
                    className="appearance-none pr-8 pl-3 py-1 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
                  >
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.email} ({s.name})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
              )}
              
              <button
                type="button"
                onClick={handleAddEtherealSender}
                disabled={creatingEthereal}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold border border-emerald-200 bg-emerald-50/50 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
              >
                {creatingEthereal ? <Loader2 className="w-3 h-3 animate-spin" /> : '+ Add Ethereal Sender'}
              </button>
            </div>
          </div>

          {/* To Field with List Upload */}
          <div className="flex items-center py-2 border-b border-slate-100 gap-4">
            <span className="w-16 text-sm text-slate-400">To</span>
            <div className="flex-1 flex items-center justify-between gap-4">
              <input
                type="text"
                placeholder={file ? `${detectedEmails} emails uploaded via list` : "Enter recipient email(s) manually..."}
                disabled={!!file}
                value={form.manualLeads}
                onChange={(e) => setForm((p) => ({ ...p, manualLeads: e.target.value }))}
                className="flex-1 bg-transparent text-sm text-slate-700 focus:outline-none placeholder:text-slate-300 disabled:opacity-75"
              />
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-[#4CAF50] hover:text-[#43A047] font-semibold transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {file ? file.name : 'Upload List'}
              </button>
            </div>
          </div>

          {/* Subject Field */}
          <div className="flex items-center py-2 border-b border-slate-100 gap-4">
            <span className="w-16 text-sm text-slate-400">Subject</span>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Enter subject line..."
              className="flex-1 bg-transparent text-sm text-slate-700 focus:outline-none placeholder:text-slate-300"
            />
          </div>

          {/* Delay & Hourly Limit config */}
          <div className="flex flex-wrap items-center py-2 border-b border-slate-100 gap-y-3 gap-x-8">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Delay between 2 emails</span>
              <input
                type="number"
                min="0"
                value={form.delaySeconds}
                onChange={(e) => setForm((p) => ({ ...p, delaySeconds: e.target.value }))}
                className="w-16 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-center text-sm font-medium text-slate-700 focus:outline-none"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Hourly Limit</span>
              <input
                type="number"
                min="1"
                value={form.hourlyLimit}
                onChange={(e) => setForm((p) => ({ ...p, hourlyLimit: e.target.value }))}
                className="w-16 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-center text-sm font-medium text-slate-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Email Body & Text Area Editor (Mock Rich Toolbar) */}
          <div className="flex-1 flex flex-col min-h-[300px] border border-slate-100 rounded-lg overflow-hidden mt-2 bg-slate-50/30">
            <textarea
              required
              placeholder="Type Your Reply..."
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              className="flex-1 p-4 bg-transparent text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none resize-none font-sans"
            />

            {/* Custom Rich Formatting Toolbar (Matches screenshot editor toolbar) */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-2 select-none">
              <div className="flex flex-wrap items-center gap-1.5 text-slate-400">
                <button type="button" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors text-xs font-bold font-serif">A</button>
                <button type="button" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors font-bold text-xs">B</button>
                <button type="button" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors italic text-xs">I</button>
                <button type="button" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors underline text-xs">U</button>
                <span className="text-slate-200">|</span>
                <button type="button" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors text-xs">🔗</button>
                <button type="button" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors text-xs">🖼️</button>
                <span className="text-slate-200">|</span>
                <button type="button" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors text-xs">Format</button>
              </div>
              
              {file && (
                <div className="text-xs text-[#4CAF50] font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {totalLeads} Leads Loaded
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Send Later Panel (Matches screenshot) */}
        {sendLaterOpen && (
          <div className="w-80 border-l border-slate-100 bg-white p-6 flex flex-col gap-5 shrink-0 z-10 shadow-sm animate-fade-in font-sans">
            <h3 className="font-bold text-slate-800 text-sm">Send Later</h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold uppercase">Pick date & time</label>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 font-semibold uppercase">Presets</label>
              <button
                type="button"
                onClick={() => setPresetTime('tomorrow')}
                className="w-full text-left px-3 py-2.5 rounded hover:bg-slate-50 text-sm text-slate-700 transition-colors"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setPresetTime('tomorrow_10')}
                className="w-full text-left px-3 py-2.5 rounded hover:bg-slate-50 text-sm text-slate-700 transition-colors"
              >
                Tomorrow, 10:00 AM
              </button>
              <button
                type="button"
                onClick={() => setPresetTime('tomorrow_11')}
                className="w-full text-left px-3 py-2.5 rounded hover:bg-slate-50 text-sm text-slate-700 transition-colors"
              >
                Tomorrow, 11:00 AM
              </button>
              <button
                type="button"
                onClick={() => setPresetTime('tomorrow_15')}
                className="w-full text-left px-3 py-2.5 rounded hover:bg-slate-50 text-sm text-slate-700 transition-colors"
              >
                Tomorrow, 3:00 PM
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 mt-auto pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSendLaterOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setSendLaterOpen(false)}
                className="px-4 py-2 text-sm font-semibold border border-[#4CAF50] text-[#4CAF50] rounded-full hover:bg-emerald-50 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComposeModal;
