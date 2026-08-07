import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Paperclip, Clock, Upload, Loader2, ChevronDown, Check, RotateCcw, RotateCw, Bold, Italic, Underline, AlignLeft, List, ListOrdered, Quote, Image, Strikethrough, Plus, X } from 'lucide-react';
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
        setAttachments((prev) => [
          ...prev,
          { name: file.name, size: sizeStr, dataUrl: base64 }
        ]);
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
    setParsedEmails([]);
    setEmailInput('');
    setAttachments([]);
    setError(null);
    setSendLaterOpen(false);
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

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col font-sans border-l border-slate-100">
      {/* Hidden file input for image uploads inside contentEditable */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Top Navigation / Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={handleClose} type="button" className="p-1 text-slate-500 hover:text-slate-800 transition-colors">
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
            className={`p-2 rounded-lg transition-colors ${sendLaterOpen ? 'text-[#4CAF50] bg-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Clock className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-[#4CAF50] text-[#4CAF50] text-sm font-semibold hover:bg-emerald-50 transition-colors disabled:opacity-50"
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
        <div className="flex-1 flex flex-col p-6 gap-5 min-w-0">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg animate-fade-in">
              {error}
            </div>
          )}

          {/* From Row */}
          <div className="flex items-center py-2 border-b border-slate-100 gap-4">
            <span className="w-16 text-sm text-slate-400 font-medium">From</span>
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
                        {s.email}
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
                className="text-xs text-[#4CAF50] hover:text-[#43A047] font-semibold border border-emerald-200 bg-emerald-50/50 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
              >
                {creatingEthereal ? <Loader2 className="w-3 h-3 animate-spin" /> : '+ Add Sender'}
              </button>
            </div>
          </div>

          {/* To Row (Matches Figma Tag Badges Layout) */}
          <div className="flex items-start py-2 border-b border-slate-100 gap-4 min-h-[44px]">
            <span className="w-16 text-sm text-slate-400 font-medium mt-1">To</span>
            <div className="flex-1 flex items-center justify-between gap-4 flex-wrap">
              
              {/* Tags Container */}
              <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                {visibleEmails.map((email, index) => (
                  <div
                    key={email}
                    className="flex items-center gap-1 px-3 py-1 rounded-full border border-emerald-200 bg-[#E8F5E9] text-[#2E7D32] text-xs font-semibold"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeEmailTag(index)}
                      className="hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                
                {extraCount > 0 && (
                  <span className="px-3 py-1 rounded-full border border-emerald-200 bg-[#E8F5E9] text-[#2E7D32] text-xs font-semibold">
                    +{extraCount}
                  </span>
                )}

                {/* Inline Email Input */}
                <input
                  type="text"
                  placeholder={parsedEmails.length === 0 ? "Enter recipient email(s) manually..." : ""}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  className="flex-grow min-w-[150px] bg-transparent text-sm text-slate-700 focus:outline-none placeholder:text-slate-300 py-1"
                />
              </div>

              {/* Upload List Trigger */}
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
                  className="flex items-center gap-1.5 text-xs text-[#4CAF50] hover:text-[#43A047] font-semibold transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload List
                </button>
              </div>
            </div>
          </div>

          {/* Subject Row */}
          <div className="flex items-center py-2 border-b border-slate-100 gap-4">
            <span className="w-16 text-sm text-slate-400 font-medium">Subject</span>
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
              <span className="text-sm text-slate-400 font-medium">Delay between 2 emails</span>
              <input
                type="number"
                min="0"
                value={form.delaySeconds}
                onChange={(e) => setForm((p) => ({ ...p, delaySeconds: e.target.value }))}
                className="w-16 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-center text-sm font-medium text-slate-700 focus:outline-none"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400 font-medium">Hourly Limit</span>
              <input
                type="number"
                min="1"
                value={form.hourlyLimit}
                onChange={(e) => setForm((p) => ({ ...p, hourlyLimit: e.target.value }))}
                className="w-16 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-center text-sm font-medium text-slate-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Email Body & Text Area Editor */}
          <div className="flex-1 flex flex-col min-h-[300px] border border-slate-100 rounded-lg overflow-hidden mt-2 bg-slate-50/30">
            {/* Real contentEditable Rich Text Area */}
            <div
              ref={editorRef}
              contentEditable
              placeholder="Type Your Reply..."
              className="flex-1 p-4 bg-transparent text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none overflow-y-auto select-text font-sans"
              style={{ minHeight: '220px' }}
            />

            {/* Render Uploaded Attachment Preview Cards at the bottom of the editor */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-4 p-4 bg-white border-t border-slate-100 select-none">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="w-40 border border-slate-200 bg-slate-50/50 rounded-xl overflow-hidden shadow-sm flex flex-col relative group animate-fade-in"
                  >
                    <img src={att.dataUrl} alt={att.name} className="h-20 w-full object-cover bg-slate-100" />
                    <div className="p-2 bg-white flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-800 truncate" title={att.name}>
                        {att.name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold">{att.size}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Rich Formatting Toolbar (Matches screenshot editor toolbar exactly) */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-2 select-none">
              <div className="flex flex-wrap items-center gap-1 text-slate-400">
                <button type="button" onClick={() => format('undo')} title="Undo" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => format('redo')} title="Redo" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-200">|</span>
                
                <button type="button" onClick={() => format('bold')} title="Bold" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => format('italic')} title="Italic" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => format('underline')} title="Underline" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-200">|</span>

                <button type="button" onClick={() => format('justifyLeft')} title="Align Left" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => format('insertUnorderedList')} title="Bullet List" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <List className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => format('insertOrderedList')} title="Numbered List" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-200">|</span>

                <button type="button" onClick={() => format('formatBlock', 'blockquote')} title="Blockquote" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={handleImageButtonClick} title="Insert Image" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <Image className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => format('strikeThrough')} title="Strikethrough" className="p-1.5 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {totalLeads > 0 && (
                <div className="text-xs text-[#2E7D32] font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {totalLeads} Lead{totalLeads !== 1 ? 's' : ''} Loaded
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Send Later Panel */}
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
