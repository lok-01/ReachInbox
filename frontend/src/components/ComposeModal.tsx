import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Clock, Users, AlertCircle, Loader2, Zap, ChevronDown } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default start time to 2 minutes from now
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 2);
      // Format for datetime-local input
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
      setError('No valid email addresses found. Upload a file or enter leads manually.');
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
    onClose();
  };

  if (!isOpen) return null;

  const totalLeads = file ? detectedEmails : countManualEmails(form.manualLeads);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#111827] shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#111827]/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Compose Campaign</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">Subject *</label>
            <input
              id="subject-input"
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Your email subject..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all duration-200 text-sm"
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">Email Body *</label>
            <textarea
              id="body-input"
              required
              rows={5}
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              placeholder="Write your email content here... (HTML supported)"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all duration-200 text-sm resize-y min-h-[120px]"
            />
          </div>

          {/* Leads Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300">Email Leads *</label>

            {/* File Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 ${
                file
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-white/15 bg-white/3 hover:border-blue-500/40 hover:bg-blue-500/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className={`w-5 h-5 ${file ? 'text-emerald-400' : 'text-slate-500'}`} />
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-emerald-400">{file.name}</p>
                  <p className="text-xs text-emerald-500/70 mt-0.5 flex items-center gap-1 justify-center">
                    <Users className="w-3 h-3" />
                    {detectedEmails} unique email{detectedEmails !== 1 ? 's' : ''} detected
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-slate-400">Click to upload CSV or TXT file</p>
                  <p className="text-xs text-slate-600 mt-0.5">or enter emails manually below</p>
                </div>
              )}
            </div>

            {/* Manual input */}
            {!file && (
              <textarea
                id="manual-leads-input"
                rows={3}
                value={form.manualLeads}
                onChange={(e) => setForm((p) => ({ ...p, manualLeads: e.target.value }))}
                placeholder="john@example.com, jane@company.com, ..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm resize-none"
              />
            )}

            {/* Lead count hint */}
            {totalLeads > 0 && (
              <p className="text-xs text-blue-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> {totalLeads} lead{totalLeads !== 1 ? 's' : ''} will be scheduled
              </p>
            )}
          </div>

          {/* Sender Selection */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">Sender *</label>
              <button
                type="button"
                onClick={handleAddEtherealSender}
                disabled={creatingEthereal}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                {creatingEthereal ? <Loader2 className="w-3 h-3 animate-spin" /> : '+'}
                Add Ethereal Test Sender
              </button>
            </div>

            {loadingSenders ? (
              <div className="h-10 rounded-lg bg-white/5 animate-pulse" />
            ) : senders.length === 0 ? (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                No senders configured. Click "Add Ethereal Test Sender" above.
              </p>
            ) : (
              <div className="relative">
                <select
                  id="sender-select"
                  required
                  value={form.senderId}
                  onChange={(e) => setForm((p) => ({ ...p, senderId: e.target.value }))}
                  className="w-full appearance-none px-3.5 py-2.5 pr-9 rounded-lg bg-white/5 border border-white/10 text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm"
                >
                  {senders.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#111827]">
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Scheduling Config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Start Time */}
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Start Time *
              </label>
              <input
                id="start-time-input"
                type="datetime-local"
                required
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm [color-scheme:dark]"
              />
            </div>

            {/* Delay */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Delay (seconds)</label>
              <input
                id="delay-input"
                type="number"
                min="1"
                max="3600"
                value={form.delaySeconds}
                onChange={(e) => setForm((p) => ({ ...p, delaySeconds: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm"
              />
            </div>

            {/* Hourly Limit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Hourly Limit</label>
              <input
                id="hourly-limit-input"
                type="number"
                min="1"
                max="10000"
                value={form.hourlyLimit}
                onChange={(e) => setForm((p) => ({ ...p, hourlyLimit: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              id="schedule-submit-btn"
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Schedule {totalLeads > 0 ? `${totalLeads} Email${totalLeads !== 1 ? 's' : ''}` : 'Campaign'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComposeModal;
