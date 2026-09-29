import { useQuery } from '@tanstack/react-query';
import { Shield, AlertTriangle, Zap, Search, TrendingUp, Users, FileWarning, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ThreatRadar from '../components/ThreatRadar';
import api from '../lib/api';

const SCAM_TYPE_LABELS: Record<string, string> = {
  ADVANCE_FEE_EQUIPMENT: 'Equipment Fee',
  FAKE_CHECK_REFUND: 'Fake Check',
  DATA_HARVESTING_IDENTITY_THEFT: 'Identity Theft',
  UNPAID_TASK_WORK: 'Unpaid Work',
  PYRAMID_MLM_RECRUITMENT: 'MLM/Pyramid',
  CHECK_CASHING_MONEY_LAUNDERING: 'Check Cashing',
  IMPERSONATED_BRAND_PHISHING: 'Brand Phishing',
  TELEGRAM_WHATSAPP_ONLY_INTERVIEW: 'WhatsApp Scam',
};

const RISK_COLORS: Record<string, string> = {
  CRITICAL_SCAM: '#ff3b5c',
  HIGH_RISK: '#ff6b35',
  SUSPICIOUS: '#f59e0b',
  LOW_RISK: '#10b981',
};

const DEMO_STATS = {
  total_reports: 1284,
  scam_type_breakdown: {
    ADVANCE_FEE_EQUIPMENT: 437,
    FAKE_CHECK_REFUND: 218,
    IMPERSONATED_BRAND_PHISHING: 196,
    TELEGRAM_WHATSAPP_ONLY_INTERVIEW: 183,
    UNPAID_TASK_WORK: 124,
    PYRAMID_MLM_RECRUITMENT: 88,
    DATA_HARVESTING_IDENTITY_THEFT: 38,
  },
  scan_risk_level_breakdown: {
    CRITICAL_SCAM: 312,
    HIGH_RISK: 498,
    SUSPICIOUS: 284,
    LOW_RISK: 206,
  },
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sublabel,
}: {
  icon: typeof Shield;
  label: string;
  value: string | number;
  color: string;
  sublabel?: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className="stat-number text-3xl" style={{ color }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {sublabel && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {sublabel}
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function RadarDashboard() {
  const { data: statsData } = useQuery({
    queryKey: ['report-stats'],
    queryFn: async () => {
      const { data } = await api.get('/reports/stats');
      return data;
    },
    retry: 1,
    placeholderData: DEMO_STATS,
  });

  const stats = statsData || DEMO_STATS;

  const chartData = Object.entries(stats.scam_type_breakdown || {})
    .map(([type, count]) => ({
      name: SCAM_TYPE_LABELS[type] || type,
      count: count as number,
      color: '#638bff',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const riskData = Object.entries(stats.scan_risk_level_breakdown || {}).map(([level, count]) => ({
    name: level.replace(/_/g, ' '),
    count: count as number,
    color: RISK_COLORS[level] || '#638bff',
  }));

  const criticalCount = stats.scan_risk_level_breakdown?.CRITICAL_SCAM || 0;
  const highRiskCount = stats.scan_risk_level_breakdown?.HIGH_RISK || 0;

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-4 py-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ background: 'rgba(255,59,92,0.1)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Live Threat Intelligence Active
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black"
            style={{ fontFamily: 'Space Grotesk', lineHeight: '1.1' }}
          >
            <span className="gradient-text">VeriJob</span>
            <br />
            <span style={{ color: 'var(--text-primary)' }}>Scam Intelligence Hub</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            AI-powered recruitment scam detection, employer trust scoring, and community-driven threat intelligence
            protecting job seekers nationwide.
          </p>

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link to="/scan" id="hero-scan-cta" className="btn-danger flex items-center gap-2">
              <Zap size={16} />
              Scan Suspicious Offer
            </Link>
            <Link to="/companies" className="btn-outline flex items-center gap-2">
              <Search size={16} />
              Check Company Trust
            </Link>
            <Link to="/report" className="btn-outline flex items-center gap-2">
              <FileWarning size={16} />
              Report a Scam
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={AlertTriangle}
            label="Total Reports"
            value={stats.total_reports}
            color="#ff3b5c"
            sublabel="Community-submitted"
          />
          <StatCard
            icon={Zap}
            label="Critical Scams"
            value={criticalCount}
            color="#ff3b5c"
            sublabel="90-100% risk score"
          />
          <StatCard
            icon={TrendingUp}
            label="High Risk Scans"
            value={highRiskCount}
            color="#ff6b35"
            sublabel="70-89% risk score"
          />
          <StatCard
            icon={Shield}
            label="Protected Users"
            value="12.4K"
            color="#10b981"
            sublabel="This month"
          />
        </div>

        {/* Charts + Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scam Type Bar Chart */}
          <div className="lg:col-span-2 glass-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                  Scam Type Distribution
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Top fraud categories from community reports
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="25%">
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-glow)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'rgba(99,139,255,0.05)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? '#ff3b5c' : i === 1 ? '#ff6b35' : i === 2 ? '#f59e0b' : '#638bff'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Risk Level Summary */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              {riskData.map(({ name, count, color }) => (
                <div key={name} className="text-center">
                  <p className="stat-number text-lg" style={{ color }}>
                    {count}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {name.split(' ')[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Threat Radar */}
          <div className="glass-card p-6">
            <ThreatRadar />
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              to: '/scan',
              title: 'AI Offer Scanner',
              description: 'Paste any job offer or recruiter message for instant fraud analysis',
              icon: Zap,
              color: '#ff3b5c',
              cta: 'Scan Now',
            },
            {
              to: '/companies',
              title: 'Company Trust Index',
              description: 'Search verified companies and check employer trust scores',
              icon: Shield,
              color: '#22d3ee',
              cta: 'Browse Directory',
            },
            {
              to: '/verify-employer',
              title: 'Employer Verification',
              description: 'Legitimate companies can claim and verify their business profile',
              icon: Users,
              color: '#10b981',
              cta: 'Get Verified',
            },
          ].map(({ to, title, description, icon: Icon, color, cta }) => (
            <Link
              key={to}
              to={to}
              className="glass-card p-6 flex flex-col gap-4 group transition-all hover:scale-[1.02]"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: `${color}20` }}
              >
                <Icon size={22} style={{ color }} />
              </div>
              <div>
                <h3 className="font-bold mb-1" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {description}
                </p>
              </div>
              <div
                className="flex items-center gap-1 text-sm font-semibold mt-auto"
                style={{ color }}
              >
                {cta}
                <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>

        {/* Warning Banner */}
        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(255,59,92,0.12) 0%, rgba(255,107,53,0.08) 100%)',
            border: '1px solid rgba(255,59,92,0.25)',
          }}
        >
          <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,59,92,0.2)' }}>
            <AlertTriangle size={24} style={{ color: '#ff3b5c' }} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold mb-1" style={{ color: '#ff3b5c' }}>
              ⚠ Never Pay to Get Hired
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Legitimate employers never ask job seekers to pay for equipment, training, background checks, or
              uniforms. Any financial request before employment is a confirmed scam indicator.
            </p>
          </div>
          <a
            href="https://www.ftc.gov/jobs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-semibold flex-shrink-0"
            style={{ color: '#ff3b5c' }}
          >
            FTC Resources
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
