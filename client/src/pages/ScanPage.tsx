import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, CheckCircle2, XCircle, Flag, ChevronRight, Info } from 'lucide-react';
import ScannerForm from '../components/ScannerForm';
import ScamGauge from '../components/ScamGauge';
import type { ScamAnalysisResult } from '../../../shared/schema';

const SCAM_TYPE_LABELS: Record<string, string> = {
  ADVANCE_FEE_EQUIPMENT: 'Advance Fee / Equipment Scam',
  FAKE_CHECK_REFUND: 'Fake Check / Refund Fraud',
  DATA_HARVESTING_IDENTITY_THEFT: 'Data Harvesting & Identity Theft',
  UNPAID_TASK_WORK: 'Unpaid Task / Work Exploitation',
  PYRAMID_MLM_RECRUITMENT: 'Pyramid Scheme / MLM Recruitment',
  CHECK_CASHING_MONEY_LAUNDERING: 'Check Cashing Money Laundering',
  IMPERSONATED_BRAND_PHISHING: 'Brand Impersonation Phishing',
  TELEGRAM_WHATSAPP_ONLY_INTERVIEW: 'Telegram/WhatsApp-Only Interview Scam',
};

interface ScanResult {
  analysis: ScamAnalysisResult;
  scan_id: string | null;
  blacklist_matches: { indicator_value: string; indicator_type: string; reason: string }[];
  community_matches: { company_claimed: string; scam_type: string; description: string }[];
}

function getRiskGlowClass(score: number) {
  if (score >= 90) return 'glow-critical';
  if (score >= 70) return 'glow-high';
  if (score >= 40) return 'glow-suspicious';
  return 'glow-safe';
}

function ResultPanel({ result }: { result: ScanResult }) {
  const { analysis, blacklist_matches, community_matches } = result;
  const score = analysis.scam_risk_score;
  const isCritical = score >= 90;
  const isHighRisk = score >= 70;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Risk Score Display */}
      <div
        className={`glass-card p-8 flex flex-col lg:flex-row items-center gap-8 ${getRiskGlowClass(score)}`}
        style={{
          border: `1px solid ${isCritical ? 'rgba(255,59,92,0.4)' : isHighRisk ? 'rgba(255,107,53,0.4)' : 'rgba(99,139,255,0.2)'}`,
        }}
      >
        <div className="flex flex-col items-center">
          <ScamGauge score={score} size={200} showLabel />
        </div>

        <div className="flex-1 space-y-4">
          {/* Scan type */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Scam Classification
            </p>
            <h2 className="text-xl font-black" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
              {SCAM_TYPE_LABELS[analysis.scam_type] || analysis.scam_type}
            </h2>
          </div>

          {/* Domain mismatch */}
          {analysis.domain_mismatch_detected && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(255,59,92,0.1)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
            >
              <XCircle size={15} />
              Domain Mismatch Detected — Recruiter email does not match claimed company
            </div>
          )}

          {/* Blacklist hits */}
          {blacklist_matches.length > 0 && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}
            >
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">Blacklisted Indicator Matched</span>
                {blacklist_matches.map((m, i) => (
                  <div key={i} className="text-xs mt-0.5">
                    {m.indicator_type}: {m.indicator_value} — {m.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              AI Forensic Analysis
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {analysis.ai_analysis_summary}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              to={`/report?company=${encodeURIComponent('')}&scan_id=${result.scan_id || ''}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,59,92,0.15)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
            >
              <Flag size={14} />
              Report This Scam
            </Link>
            <Link
              to="/companies"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: 'rgba(99,139,255,0.1)', color: 'var(--accent-blue)', border: '1px solid var(--border-glow)' }}
            >
              <Shield size={14} />
              Check Company Trust
            </Link>
          </div>
        </div>
      </div>

      {/* Red Flags */}
      {analysis.red_flags.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <XCircle size={18} style={{ color: '#ff3b5c' }} />
            <h3 className="font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
              {analysis.red_flags.length} Red Flag{analysis.red_flags.length !== 1 ? 's' : ''} Detected
            </h3>
          </div>
          <ul className="space-y-2">
            {analysis.red_flags.map((flag, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,59,92,0.06)', border: '1px solid rgba(255,59,92,0.15)' }}
              >
                <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'rgba(255,59,92,0.2)', color: '#ff3b5c' }}
                >
                  {i + 1}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {analysis.actionable_recommendations.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
            <h3 className="font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
              Protective Actions — Do This Now
            </h3>
          </div>
          <ul className="space-y-2">
            {analysis.actionable_recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
              >
                <ChevronRight size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Community Matches */}
      {community_matches.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Info size={18} style={{ color: '#f59e0b' }} />
            <h3 className="font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
              {community_matches.length} Matching Community Report{community_matches.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="space-y-3">
            {community_matches.map((match, i) => (
              <div
                key={i}
                className="p-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <p className="text-xs font-bold mb-1" style={{ color: '#f59e0b' }}>
                  {match.company_claimed} — {match.scam_type.replace(/_/g, ' ')}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {match.description.substring(0, 150)}…
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan Again */}
      <div className="text-center pt-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="btn-outline"
        >
          Run Another Scan
        </button>
      </div>
    </div>
  );
}

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Page Header */}
        <div className="space-y-3">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(255,59,92,0.1)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
          >
            <AlertTriangle size={12} />
            AI Scam Detection Engine — Powered by Gemini
          </div>
          <h1
            className="text-3xl sm:text-4xl font-black"
            style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}
          >
            Job Offer & Scam Scanner
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Submit any suspicious job offer, recruiter email, or employment contract for instant AI forensic analysis.
            Our system detects advance-fee fraud, fake checks, domain mismatches, and 8+ other scam patterns.
          </p>
        </div>

        {/* Scanner Form */}
        {!scanResult ? (
          <div className="glass-card p-6 sm:p-8">
            <ScannerForm onResult={(result) => setScanResult(result)} />
          </div>
        ) : (
          <ResultPanel result={scanResult} />
        )}

        {/* Info Cards */}
        {!scanResult && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: '8+ Scam Patterns',
                desc: 'Detects all major recruitment fraud types including advance-fee, fake check, identity theft, and MLM schemes',
                icon: Shield,
                color: '#638bff',
              },
              {
                title: 'Domain Verification',
                desc: 'Automatically checks if recruiter email domain matches the legitimate company domain',
                icon: CheckCircle2,
                color: '#22d3ee',
              },
              {
                title: 'Blacklist Cross-Check',
                desc: 'Matches recruiter emails and phone numbers against our community-built blacklist database',
                icon: XCircle,
                color: '#ff3b5c',
              },
            ].map(({ title, desc, icon: Icon, color }) => (
              <div key={title} className="glass-card p-4 space-y-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}20` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
