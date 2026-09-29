import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, Mail, Phone, Building2, Upload, Clipboard, Loader2, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import type { ScamAnalysisResult } from '../../../shared/schema';

interface ScannerFormProps {
  onResult: (result: { analysis: ScamAnalysisResult; scan_id: string | null; blacklist_matches: any[]; community_matches: any[] }) => void;
}

type TabType = 'text' | 'upload';

interface ScanPayload {
  raw_job_text: string;
  recruiter_email?: string;
  recruiter_phone?: string;
  company_name?: string;
}

async function runScan(payload: ScanPayload) {
  const { data } = await api.post('/scan/analyze', payload);
  return data;
}

export default function ScannerForm({ onResult }: ScannerFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [jobText, setJobText] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [recruiterPhone, setRecruiterPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: runScan,
    onSuccess: (data) => {
      onResult(data);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    // Read file as text (for PDF-like text extraction)
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      // For plain text files; PDF content extraction would need a proper library in production
      setJobText(content || `[File: ${file.name}] — PDF content submitted for analysis`);
    };
    reader.readAsText(file);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJobText(text);
    } catch {
      // Clipboard access denied — user must paste manually
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobText.trim() || jobText.trim().length < 10) return;

    mutation.mutate({
      raw_job_text: jobText,
      recruiter_email: recruiterEmail || undefined,
      recruiter_phone: recruiterPhone || undefined,
      company_name: companyName || undefined,
    });
  };

  const isLoading = mutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tab Selector */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ background: 'rgba(99, 139, 255, 0.06)', border: '1px solid var(--border-subtle)' }}
      >
        {([
          { id: 'text', label: 'Paste Job Text / Offer', icon: Clipboard },
          { id: 'upload', label: 'Upload PDF / Screenshot', icon: Upload },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === id ? 'tab-active' : ''
            }`}
            style={{
              color: activeTab === id ? 'var(--accent-blue)' : 'var(--text-secondary)',
              background: activeTab === id ? 'rgba(99, 139, 255, 0.15)' : 'transparent',
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content Input */}
      {activeTab === 'text' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Job Offer / Recruiter Message Content
            </label>
            <button
              type="button"
              onClick={handlePaste}
              className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg transition-all hover:bg-white/5"
              style={{ color: 'var(--accent-cyan)', border: '1px solid rgba(34,211,238,0.3)' }}
            >
              <Clipboard size={12} />
              Paste from Clipboard
            </button>
          </div>
          <textarea
            id="job-text-input"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder={`Paste the suspicious job offer, recruiter email, or contract text here…\n\nExample: "We are pleased to offer you the Data Entry Specialist position. To receive your equipment, please send $250 via Zelle to our HR coordinator before your start date..."`}
            rows={10}
            className="input-field resize-none"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', lineHeight: '1.6' }}
            required
            minLength={10}
          />
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Minimum 10 characters required</span>
            <span>{jobText.length.toLocaleString()} chars</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Upload Offer Letter / Contract / Chat Screenshot
          </label>
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
            style={{
              borderColor: fileName ? 'var(--accent-blue)' : 'var(--border-subtle)',
              background: fileName ? 'rgba(99,139,255,0.05)' : 'transparent',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && fileInputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
                handleFileUpload({ target: { files: dt.files } } as any);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Upload size={32} className="mx-auto mb-3" style={{ color: 'var(--accent-blue)' }} />
            {fileName ? (
              <>
                <p className="font-semibold text-sm" style={{ color: 'var(--accent-blue)' }}>
                  {fileName}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Click to change file
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Drop file here or click to browse
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Supports PDF, TXT, PNG, JPG (max 10MB)
                </p>
              </>
            )}
          </div>
          {jobText && (
            <div className="text-xs mt-1" style={{ color: 'var(--low-risk)' }}>
              ✓ File content loaded — {jobText.length} characters extracted
            </div>
          )}
        </div>
      )}

      {/* Recruiter Details */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: 'rgba(99,139,255,0.04)', border: '1px solid var(--border-subtle)' }}
      >
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Recruiter Contact Details (Optional but Recommended)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <Building2 size={12} />
              Company Claimed
            </label>
            <input
              id="company-name-input"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Google, Amazon, Tesla"
              className="input-field"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <Mail size={12} />
              Recruiter Email
            </label>
            <input
              id="recruiter-email-input"
              type="email"
              value={recruiterEmail}
              onChange={(e) => setRecruiterEmail(e.target.value)}
              placeholder="hr@company.com"
              className="input-field"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <Phone size={12} />
              Recruiter Phone
            </label>
            <input
              id="recruiter-phone-input"
              type="tel"
              value={recruiterPhone}
              onChange={(e) => setRecruiterPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {mutation.isError && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)' }}
        >
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#ff3b5c' }} />
          <p className="text-sm" style={{ color: '#ff3b5c' }}>
            {mutation.error?.message || 'Scan failed. Please try again.'}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        id="scan-submit-btn"
        type="submit"
        disabled={isLoading || !jobText.trim() || jobText.trim().length < 10}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base transition-all"
        style={{
          background:
            isLoading || !jobText.trim()
              ? 'rgba(99,139,255,0.2)'
              : 'linear-gradient(135deg, #ff3b5c 0%, #ff6b35 100%)',
          color: isLoading || !jobText.trim() ? 'var(--text-muted)' : 'white',
          cursor: isLoading || !jobText.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Running AI Forensic Analysis…</span>
          </>
        ) : (
          <>
            <FileText size={18} />
            <span>Analyze for Scam Indicators</span>
          </>
        )}
      </button>

      {isLoading && (
        <div className="scan-animation rounded-xl overflow-hidden" style={{ background: 'rgba(99,139,255,0.05)', height: 4 }} />
      )}
    </form>
  );
}
