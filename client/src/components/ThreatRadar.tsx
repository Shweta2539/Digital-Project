import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp, Clock, DollarSign, Wifi } from 'lucide-react';
import api from '../lib/api';

const SCAM_TYPE_LABELS: Record<string, string> = {
  ADVANCE_FEE_EQUIPMENT: 'Advance Fee / Equipment',
  FAKE_CHECK_REFUND: 'Fake Check / Refund',
  DATA_HARVESTING_IDENTITY_THEFT: 'Identity Theft',
  UNPAID_TASK_WORK: 'Unpaid Task Work',
  PYRAMID_MLM_RECRUITMENT: 'MLM / Pyramid Scheme',
  CHECK_CASHING_MONEY_LAUNDERING: 'Check Cashing Scam',
  IMPERSONATED_BRAND_PHISHING: 'Brand Impersonation',
  TELEGRAM_WHATSAPP_ONLY_INTERVIEW: 'WhatsApp/Telegram Scam',
};

const SCAM_TYPE_COLORS: Record<string, string> = {
  ADVANCE_FEE_EQUIPMENT: '#ff3b5c',
  FAKE_CHECK_REFUND: '#ff6b35',
  DATA_HARVESTING_IDENTITY_THEFT: '#a855f7',
  UNPAID_TASK_WORK: '#f59e0b',
  PYRAMID_MLM_RECRUITMENT: '#ec4899',
  CHECK_CASHING_MONEY_LAUNDERING: '#ff3b5c',
  IMPERSONATED_BRAND_PHISHING: '#06b6d4',
  TELEGRAM_WHATSAPP_ONLY_INTERVIEW: '#22d3ee',
};

// Simulated data for demo when API isn't available
const DEMO_REPORTS = [
  {
    id: '1',
    company_claimed: 'Amazon Logistics',
    scam_type: 'ADVANCE_FEE_EQUIPMENT',
    description: 'Recruiter asked for $300 Zelle payment for "laptop deposit" before first day.',
    upvotes: 47,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    payment_method_requested: 'Zelle',
  },
  {
    id: '2',
    company_claimed: 'Google Remote Careers',
    scam_type: 'IMPERSONATED_BRAND_PHISHING',
    description: 'Fake Google recruiter using @google-hr-remote.com domain. Sent fake offer letter.',
    upvotes: 89,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    payment_method_requested: null,
  },
  {
    id: '3',
    company_claimed: 'TaskPro Solutions',
    scam_type: 'UNPAID_TASK_WORK',
    description: 'Completed 3 weeks of "trial tasks" with no pay. Company disappeared after.',
    upvotes: 31,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    payment_method_requested: null,
  },
  {
    id: '4',
    company_claimed: 'Bank of America HR',
    scam_type: 'FAKE_CHECK_REFUND',
    description: 'Sent $2,500 check, asked to keep $200 and forward rest. Check bounced.',
    upvotes: 62,
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    payment_method_requested: 'Wire Transfer',
  },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ThreatRadar() {
  const { data, isError } = useQuery({
    queryKey: ['recent-reports'],
    queryFn: async () => {
      const { data } = await api.get('/reports/recent?limit=8');
      return data.reports;
    },
    refetchInterval: 30000,
    retry: 1,
  });

  const reports = (isError || !data?.length) ? DEMO_REPORTS : data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#ff3b5c' }}
          />
          <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Live Threat Intelligence Feed
          </h2>
        </div>
        <div
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
          style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}
        >
          <Wifi size={10} />
          Real-time
        </div>
      </div>

      {/* Reports Feed */}
      <div className="space-y-3">
        {reports.map((report: typeof DEMO_REPORTS[number]) => {
          const color = SCAM_TYPE_COLORS[report.scam_type] || '#8899cc';
          return (
            <div
              key={report.id}
              className="glass-card p-4 transition-all hover:scale-[1.01]"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                    >
                      {SCAM_TYPE_LABELS[report.scam_type] || report.scam_type}
                    </span>
                    {report.payment_method_requested && (
                      <span
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,59,92,0.1)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
                      >
                        <DollarSign size={9} />
                        {report.payment_method_requested}
                      </span>
                    )}
                  </div>

                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                    {report.company_claimed}
                  </p>
                  <p
                    className="text-xs line-clamp-2"
                    style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}
                  >
                    {report.description}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={10} />
                    {timeAgo(report.created_at)}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#f59e0b' }}>
                    <TrendingUp size={10} />
                    {report.upvotes}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trending Scam Types */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: 'rgba(99,139,255,0.04)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} style={{ color: 'var(--suspicious)' }} />
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Trending This Week
          </h3>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Equipment Fee / Advance Pay', pct: 34, color: '#ff3b5c' },
            { label: 'WhatsApp-Only Interview', pct: 28, color: '#ff6b35' },
            { label: 'Brand Impersonation (Google, Amazon)', pct: 21, color: '#a855f7' },
            { label: 'Fake Check / Refund', pct: 17, color: '#f59e0b' },
          ].map(({ label, pct, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color }} className="font-semibold">{pct}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(99,139,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
