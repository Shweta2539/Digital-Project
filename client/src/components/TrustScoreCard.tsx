import { CheckCircle2, XCircle, Shield, TrendingUp, Users, Globe } from 'lucide-react';
import type { VerificationStatus } from '../../../shared/schema';

interface TrustScoreCardProps {
  company: {
    name: string;
    official_domain: string;
    verification_status: VerificationStatus;
    trust_score: number;
    industry?: string;
    headquarters?: string;
    trust_breakdown?: {
      score_components?: {
        verification_status_score: number;
        domain_age_score: number;
        community_penalty: number;
        email_consistency_score: number;
        linkedin_score: number;
      };
      risk_label?: string;
      risk_color?: string;
    };
  };
  communityReportCount?: number;
}

const VERIFICATION_CONFIG: Record<VerificationStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  VERIFIED_OFFICIAL: { label: 'Verified Official', color: '#10b981', icon: CheckCircle2 },
  PENDING_REVIEW: { label: 'Pending Review', color: '#f59e0b', icon: Shield },
  UNVERIFIED_FREE_DOMAIN: { label: 'Unverified Domain', color: '#8899cc', icon: Globe },
  SUSPECTED_IMPERSONATION: { label: 'Suspected Impersonation', color: '#ff6b35', icon: XCircle },
  CONFIRMED_FRAUDULENT: { label: 'Confirmed Fraudulent', color: '#ff3b5c', icon: XCircle },
};

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color }}>
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(99,139,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function TrustScoreCard({ company, communityReportCount = 0 }: TrustScoreCardProps) {
  const config = VERIFICATION_CONFIG[company.verification_status] || VERIFICATION_CONFIG.UNVERIFIED_FREE_DOMAIN;
  const VerifyIcon = config.icon;
  const components = company.trust_breakdown?.score_components;

  const getTrustColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#ff6b35';
    return '#ff3b5c';
  };

  const trustColor = getTrustColor(company.trust_score);

  return (
    <div className="glass-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk' }}>
            {company.name}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {company.official_domain}
          </p>
        </div>

        {/* Trust Score Ring */}
        <div className="flex flex-col items-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl relative"
            style={{
              background: `conic-gradient(${trustColor} ${company.trust_score * 3.6}deg, rgba(99,139,255,0.1) 0deg)`,
              fontFamily: 'Space Grotesk',
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-card)', color: trustColor }}
            >
              <span className="text-sm font-bold">{company.trust_score}</span>
            </div>
          </div>
          <span className="text-xs mt-1 font-semibold uppercase tracking-wide" style={{ color: trustColor }}>
            Trust Score
          </span>
        </div>
      </div>

      {/* Verification Badge */}
      <div
        className="flex items-center gap-2.5 p-3 rounded-xl"
        style={{ background: `${config.color}15`, border: `1px solid ${config.color}40` }}
      >
        <VerifyIcon size={16} style={{ color: config.color }} />
        <span className="text-sm font-semibold" style={{ color: config.color }}>
          {config.label}
        </span>
      </div>

      {/* Meta Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {company.industry && (
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Industry</p>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{company.industry}</p>
          </div>
        )}
        {company.headquarters && (
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>HQ</p>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{company.headquarters}</p>
          </div>
        )}
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Community Reports</p>
          <div className="flex items-center gap-1">
            <Users size={12} style={{ color: communityReportCount > 0 ? '#ff6b35' : '#10b981' }} />
            <p className="font-medium" style={{ color: communityReportCount > 0 ? '#ff6b35' : '#10b981' }}>
              {communityReportCount} {communityReportCount === 1 ? 'report' : 'reports'}
            </p>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      {components && (
        <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} style={{ color: 'var(--accent-blue)' }} />
            <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Trust Score Breakdown
            </h4>
          </div>

          <ScoreBar label="Verification Status" value={components.verification_status_score} max={35} color={trustColor} />
          <ScoreBar label="Domain Age & Quality" value={components.domain_age_score} max={20} color={trustColor} />
          <ScoreBar label="Community Safety" value={components.community_penalty} max={25} color={components.community_penalty > 15 ? '#10b981' : '#ff6b35'} />
          <ScoreBar label="Email Consistency" value={components.email_consistency_score} max={10} color={trustColor} />
          <ScoreBar label="LinkedIn Presence" value={components.linkedin_score} max={10} color={trustColor} />
        </div>
      )}
    </div>
  );
}
