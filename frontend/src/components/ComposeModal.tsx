import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, Clock, Upload, Loader2, ChevronDown, Check, Bold, Italic, Underline, List, Image, X, Minus, Maximize2, Minimize2, Plus } from 'lucide-react';
import { api } from '../api';
import type { Sender } from '../types';
import { useAuth } from '../context/AuthContext';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (leadsCount?: number) => void;
}

interface FormState {
  subject: string;
  senderId: string;
  startTime: string;
  delaySeconds: string;
  hourlyLimit: string;
}

interface AttachmentInfo {
  name: string;
  size: string;
  dataUrl: string;
}

const DEFAULT_FORM: FormState = {
  subject: '',
  senderId: '',
  startTime: '',
  delaySeconds: '5',
  hourlyLimit: '100',
};

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingEthereal, setCreatingEthereal] = useState(false);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  
  // Resize states matching "expand/compress window" requirements
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

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
      const unique = Array.from(new Set(emails.map((em) => em.toLowerCase())));
      setParsedEmails(unique);
    }
  };

  // Add email tag from manual input
  const addEmailTag = (email: string) => {
    const clean = email.trim().replace(/,/g, '');
    if (clean && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(clean)) {
      if (!parsedEmails.includes(clean.toLowerCase())) {
        setParsedEmails((prev) => [...prev, clean.toLowerCase()]);
      }
      setEmailInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      addEmailTag(emailInput);
    }
  };

  const handleBlur = () => {
    addEmailTag(emailInput);
  };

  const removeEmailTag = (index: number) => {
    setParsedEmails((prev) => prev.filter((_, i) => i !== index));
    if (file) {
      setFile(null); // Reset file if they manually edit the tags
    }
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

  // Editor Commands
  const format = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleImageButtonClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const sizeStr = `${sizeMB} MB`;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        // 1. Add to attachments preview lists at bottom
        setAttachments((prev) => [
          ...prev,
          { name: file.name, size: sizeStr, dataUrl: base64 }
        ]);
        // 2. Insert inline into editor at the cursor
        format('insertImage', base64);
      };
      reader.readAsDataURL(file);
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

    if (parsedEmails.length === 0) {
      setError('No valid email addresses found. Upload a list or type recipients.');
      return;
    }

    let bodyContent = editorRef.current?.innerHTML || '';
    if (!bodyContent.replace(/<[^>]*>/g, '').trim()) {
      setError('Email body content cannot be empty.');
      return;
    }

    // Append attachments as inline references inside body HTML for storage
    if (attachments.length > 0) {
      let attachmentTags = '';
      attachments.forEach((att) => {
        // Embed hidden attachment tags so they can be parsed out dynamically in details pane
        attachmentTags += `<img class="email-attachment-file" src="${att.dataUrl}" alt="${att.name}" data-filename="${att.name}" data-filesize="${att.size}" style="display:none;" />`;
      });
      bodyContent += `\n${attachmentTags}`;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('senderId', form.senderId);
      formData.append('subject', form.subject);
      formData.append('body', bodyContent);
      formData.append('startTime', new Date(form.startTime).toISOString());
      formData.append('delaySeconds', form.delaySeconds);
      formData.append('hourlyLimit', form.hourlyLimit);
      
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('manualLeads', parsedEmails.join(','));
      }

      const res = await api.scheduleCampaign(formData);
      onSuccess(res.leadsCount);
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
    setParsedEmails([]);
    setEmailInput('');
    setAttachments([]);
    setError(null);
    setSendLaterOpen(false);
    setIsMinimized(false);
    setIsMaximized(false);
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  const totalLeads = parsedEmails.length;
  const isScheduledLater = new Date(form.startTime).getTime() > Date.now() + 180000;

  // Max 3 emails shown as tags, the rest in a +N badge
  const visibleEmails = parsedEmails.slice(0, 3);
  const extraCount = parsedEmails.length - 3;

  // Render minimized header pill at the bottom right
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-12 w-80 h-12 bg-slate-900 border border-slate-800 rounded-t-xl shadow-2xl flex items-center justify-between px-4 z-50 select-none animate-fade-in font-sans">
        <span 
          className="font-bold text-xs text-white cursor-pointer flex-grow py-3"
          onClick={() => setIsMinimized(false)}
        >
          New Message ({totalLeads > 0 ? `${totalLeads} leads` : 'Draft'})
        </span>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setIsMinimized(false)}
            title="Expand Composer"
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleClose}
            title="Close"
            className="p-1 hover:bg-red-600 rounded text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Floating responsive layouts
  const containerClasses = isMaximized
    ? 'fixed inset-6 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-40 transition-all duration-300 font-sans'
    : 'fixed bottom-0 right-12 w-[620px] h-[580px] bg-white border border-slate-200 rounded-t-2xl shadow-2xl flex flex-col z-40 transition-all duration-300 font-sans';

  return (
    <div className={containerClasses}>
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Top Header Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-[#FCFCFD] rounded-t-2xl select-none">
        <span className="font-bold text-slate-800 text-sm">Compose New Email</span>

        <div className="flex items-center gap-3">
          {/* Minimize / Compress button */}
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            title="Compress/Minimize Window"
            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Expand button */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restore size" : "Expand/Maximize Window"}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            title="Close"
            className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inner layout with scroll capability */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Form Editor */}
        <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg animate-fade-in">
              {error}
            </div>
          )}

          {/* From Row */}
          <div className="flex items-center py-1 border-b border-slate-100 gap-4">
            <span className="w-12 text-xs text-slate-400 font-semibold uppercase">From</span>
            <div className="flex-1 flex items-center gap-3">
              {loadingSenders ? (
                <div className="w-36 h-6 bg-slate-50 animate-pulse rounded" />
              ) : (
                <div className="relative flex items-center">
                  <select
                    value={form.senderId}
                    onChange={(e) => setForm((p) => ({ ...p, senderId: e.target.value }))}
                    className="appearance-none pr-8 pl-3 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
                  >
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.email}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
              )}
              
              <button
                type="button"
                onClick={handleAddEtherealSender}
                disabled={creatingEthereal}
                className="text-[10px] text-[#2E7D32] hover:text-[#1B5E20] font-bold border border-emerald-100 bg-emerald-50/50 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
              >
                {creatingEthereal ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '+ Add Sender'}
              </button>
            </div>
          </div>

          {/* To Row */}
          <div className="flex items-start py-1 border-b border-slate-100 gap-4 min-h-[38px]">
            <span className="w-12 text-xs text-slate-400 font-semibold uppercase mt-1.5">To</span>
            <div className="flex-1 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                {visibleEmails.map((email, index) => (
                  <div
                    key={email}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-emerald-200 bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeEmailTag(index)}
                      className="hover:text-red-600 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                
                {extraCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full border border-emerald-200 bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold">
                    +{extraCount}
                  </span>
                )}

                <input
                  type="text"
                  placeholder={parsedEmails.length === 0 ? "Enter recipient email(s) manually..." : ""}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  className="flex-grow min-w-[120px] bg-transparent text-xs text-slate-700 focus:outline-none placeholder:text-slate-300 py-1"
                />
              </div>

              <div className="shrink-0">
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
                  className="flex items-center gap-1 text-[10px] text-[#2E7D32] hover:text-[#1B5E20] font-bold transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Upload List
                </button>
              </div>
            </div>
          </div>

          {/* Subject Row */}
          <div className="flex items-center py-1 border-b border-slate-100 gap-4">
            <span className="w-12 text-xs text-slate-400 font-semibold uppercase">Subject</span>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Enter subject line..."
              className="flex-1 bg-transparent text-xs text-slate-700 focus:outline-none placeholder:text-slate-300"
            />
          </div>

          {/* Delay & Limit Config */}
          <div className="flex flex-wrap items-center py-1 border-b border-slate-100 gap-y-2 gap-x-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Delay</span>
              <input
                type="number"
                min="0"
                value={form.delaySeconds}
                onChange={(e) => setForm((p) => ({ ...p, delaySeconds: e.target.value }))}
                className="w-12 px-1 py-0.5 rounded bg-slate-50 border border-slate-200 text-center text-xs font-semibold text-slate-700 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 font-medium lowercase">sec</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Hourly Limit</span>
              <input
                type="number"
                min="1"
                value={form.hourlyLimit}
                onChange={(e) => setForm((p) => ({ ...p, hourlyLimit: e.target.value }))}
                className="w-12 px-1 py-0.5 rounded bg-slate-50 border border-slate-200 text-center text-xs font-semibold text-slate-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Editor Container */}
          <div className="flex-grow flex flex-col min-h-[180px] border border-slate-100 rounded-xl overflow-hidden mt-1 bg-slate-50/20">
            <div
              ref={editorRef}
              contentEditable
              {...({ placeholder: "Type Your Message..." } as any)}
              className="flex-grow p-3 bg-transparent text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none overflow-y-auto select-text font-sans"
              style={{ minHeight: '120px' }}
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2.5 p-3 bg-white border-t border-slate-100 select-none">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="w-28 border border-slate-100 bg-slate-50/50 rounded-lg overflow-hidden flex flex-col relative group animate-fade-in"
                  >
                    <img src={att.dataUrl} alt={att.name} className="h-14 w-full object-cover bg-slate-100" />
                    <div className="p-1 bg-white flex flex-col gap-0.5">
                      <span className="text-[8px] font-bold text-slate-800 truncate" title={att.name}>{att.name}</span>
                      <span className="text-[7px] text-slate-400 font-semibold">{att.size}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Toolbar */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-3 py-1.5 select-none">
              <div className="flex flex-wrap items-center gap-0.5 text-slate-400">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => format('bold')} title="Bold" className="p-1 hover:text-slate-800 hover:bg-slate-50 rounded">
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => format('italic')} title="Italic" className="p-1 hover:text-slate-800 hover:bg-slate-50 rounded">
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => format('underline')} title="Underline" className="p-1 hover:text-slate-800 hover:bg-slate-50 rounded">
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-200 mx-1">|</span>

                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => format('insertUnorderedList')} title="List" className="p-1 hover:text-slate-800 hover:bg-slate-50 rounded">
                  <List className="w-3.5 h-3.5" />
                </button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleImageButtonClick} title="Insert Image" className="p-1 hover:text-slate-800 hover:bg-slate-50 rounded">
                  <Image className="w-3.5 h-3.5" />
                </button>
              </div>

              {totalLeads > 0 && (
                <div className="text-[10px] text-[#2E7D32] font-bold flex items-center gap-0.5">
                  <Check className="w-3 h-3" />
                  {totalLeads} Lead{totalLeads !== 1 ? 's' : ''} Loaded
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Send Later Tab */}
        {sendLaterOpen && (
          <div className="w-64 border-l border-slate-100 bg-[#FCFCFD] p-4 flex flex-col gap-4 shrink-0 z-10 shadow-sm animate-fade-in">
            <h4 className="font-bold text-slate-800 text-xs">Send Later</h4>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-400 font-bold uppercase">Time</label>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <label className="text-[9px] text-slate-400 font-bold uppercase">Presets</label>
              <button type="button" onClick={() => setPresetTime('tomorrow')} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 text-xs text-slate-600 transition-colors">Tomorrow</button>
              <button type="button" onClick={() => setPresetTime('tomorrow_10')} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 text-xs text-slate-600 transition-colors">Tomorrow, 10:00 AM</button>
              <button type="button" onClick={() => setPresetTime('tomorrow_11')} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 text-xs text-slate-600 transition-colors">Tomorrow, 11:00 AM</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Submit Buttons */}
      <div className="border-t border-slate-100 bg-[#FCFCFD] px-5 py-3.5 flex items-center justify-between rounded-b-2xl select-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleImageButtonClick}
            title="Attach file / image"
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            onClick={() => setSendLaterOpen(!sendLaterOpen)}
            className={`p-2 rounded-lg transition-colors ${sendLaterOpen ? 'text-[#2E7D32] bg-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold shadow-md shadow-emerald-500/10 hover:from-emerald-600 hover:to-green-700 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isScheduledLater ? (
              'Schedule Later'
            ) : (
              'Send Campaign'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
