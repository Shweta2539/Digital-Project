import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Shield, CheckCircle2, XCircle, Globe, ChevronRight, Filter } from 'lucide-react';
import api from '../lib/api';

const VERIFICATION_COLORS: Record<string, string> = {
  VERIFIED_OFFICIAL: '#10b981',
  PENDING_REVIEW: '#f59e0b',
  UNVERIFIED_FREE_DOMAIN: '#8899cc',
  SUSPECTED_IMPERSONATION: '#ff6b35',
  CONFIRMED_FRAUDULENT: '#ff3b5c',
};

const VERIFICATION_LABELS: Record<string, string> = {
  VERIFIED_OFFICIAL: 'Verified',
  PENDING_REVIEW: 'Pending',
  UNVERIFIED_FREE_DOMAIN: 'Unverified',
  SUSPECTED_IMPERSONATION: 'Suspicious',
  CONFIRMED_FRAUDULENT: 'Fraudulent',
};

// Demo data for display when backend not connected
const DEMO_COMPANIES = [
  { id: '1', name: 'Google LLC', official_domain: 'google.com', verification_status: 'VERIFIED_OFFICIAL', trust_score: 97, industry: 'Technology', headquarters: 'Mountain View, CA' },
  { id: '2', name: 'Amazon.com Inc', official_domain: 'amazon.com', verification_status: 'VERIFIED_OFFICIAL', trust_score: 95, industry: 'E-Commerce / Cloud', headquarters: 'Seattle, WA' },
  { id: '3', name: 'Microsoft Corporation', official_domain: 'microsoft.com', verification_status: 'VERIFIED_OFFICIAL', trust_score: 96, industry: 'Technology', headquarters: 'Redmond, WA' },
  { id: '4', name: 'Google Careers Dept', official_domain: 'google-careers-dept.com', verification_status: 'CONFIRMED_FRAUDULENT', trust_score: 3, industry: 'Fraudulent', headquarters: 'Unknown' },
  { id: '5', name: 'TaskPro Solutions', official_domain: 'taskpro-solutions.net', verification_status: 'SUSPECTED_IMPERSONATION', trust_score: 22, industry: 'Staffing', headquarters: 'Unknown' },
  { id: '6', name: 'Deloitte', official_domain: 'deloitte.com', verification_status: 'VERIFIED_OFFICIAL', trust_score: 92, industry: 'Consulting', headquarters: 'New York, NY' },
  { id: '7', name: 'Global Recruitment Partners', official_domain: 'globalrecruitmentpartners-inc.com', verification_status: 'UNVERIFIED_FREE_DOMAIN', trust_score: 36, industry: 'Staffing', headquarters: 'Unknown' },
  { id: '8', name: 'Apple Inc.', official_domain: 'apple.com', verification_status: 'VERIFIED_OFFICIAL', trust_score: 98, industry: 'Technology', headquarters: 'Cupertino, CA' },
];

function TrustBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#ff6b35' : '#ff3b5c';
  return (
    <div
      className="flex items-center justify-center w-12 h-12 rounded-full font-bold text-sm"
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, rgba(99,139,255,0.08) 0deg)`,
        fontFamily: 'Space Grotesk',
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'var(--bg-card)', color }}
      >
        {score}
      </div>
    </div>
  );
}

export default function CompanyDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [minTrust, setMinTrust] = useState(0);
  const [page, setPage] = useState(1);

  const searchQuery = searchParams.get('search') || '';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['companies', searchQuery, statusFilter, minTrust, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter && { verification_status: statusFilter }),
        ...(minTrust > 0 && { min_trust: minTrust.toString() }),
      });
      const { data } = await api.get(`/companies?${params}`);
      return data;
    },
    retry: 1,
    placeholderData: { companies: DEMO_COMPANIES, total: DEMO_COMPANIES.length, total_pages: 1 },
  });

  const companies = (isError || !data?.companies?.length)
    ? DEMO_COMPANIES.filter(c =>
        !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.official_domain.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : data.companies;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (localSearch.trim()) {
      setSearchParams({ search: localSearch.trim() });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }}
          >
            <Shield size={12} />
            Company Trust Directory
          </div>
          <h1 className="text-3xl sm:text-4xl font-black" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Employer Trust Index
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Search verified companies, check trust scores, and identify fraudulent employer profiles before applying.
          </p>
        </div>

        {/* Search + Filters */}
        <div className="glass-card p-5 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                id="company-search-input"
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search company name or domain (e.g. google.com, Amazon)"
                className="input-field pl-10"
              />
            </div>
            <button type="submit" className="btn-primary whitespace-nowrap">
              Search
            </button>
          </form>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Filter size={13} />
              Filters:
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="input-field py-1.5 text-xs w-auto"
              style={{ width: 'auto', paddingRight: '2rem' }}
              id="status-filter"
            >
              <option value="">All Statuses</option>
              <option value="VERIFIED_OFFICIAL">Verified Official</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="UNVERIFIED_FREE_DOMAIN">Unverified</option>
              <option value="SUSPECTED_IMPERSONATION">Suspected Impersonation</option>
              <option value="CONFIRMED_FRAUDULENT">Confirmed Fraudulent</option>
            </select>

            <select
              value={minTrust}
              onChange={(e) => { setMinTrust(parseInt(e.target.value)); setPage(1); }}
              className="input-field py-1.5 text-xs w-auto"
              style={{ width: 'auto', paddingRight: '2rem' }}
              id="trust-filter"
            >
              <option value={0}>Any Trust Score</option>
              <option value={80}>80+ (Trusted)</option>
              <option value={60}>60+ (Moderate)</option>
              <option value={40}>40+ (Caution)</option>
            </select>
          </div>
        </div>

        {/* Companies Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card p-6 h-40 animate-pulse" style={{ background: 'rgba(99,139,255,0.04)' }} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((company: typeof DEMO_COMPANIES[number]) => {
                const statusColor = VERIFICATION_COLORS[company.verification_status] || '#8899cc';
                const statusLabel = VERIFICATION_LABELS[company.verification_status] || company.verification_status;
                const VerifyIcon = company.verification_status === 'VERIFIED_OFFICIAL'
                  ? CheckCircle2
                  : company.verification_status === 'CONFIRMED_FRAUDULENT' || company.verification_status === 'SUSPECTED_IMPERSONATION'
                  ? XCircle
                  : Globe;

                return (
                  <Link
                    key={company.id}
                    to={`/companies/${company.id}`}
                    className="glass-card p-5 group hover:scale-[1.02] transition-all"
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-bold truncate"
                          style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}
                        >
                          {company.name}
                        </h3>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                          {company.official_domain}
                        </p>
                      </div>
                      <TrustBadge score={company.trust_score} />
                    </div>

                    {/* Status Badge */}
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold mb-3 w-fit"
                      style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}
                    >
                      <VerifyIcon size={11} />
                      {statusLabel}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{company.industry || 'Unknown Industry'}</span>
                      <ChevronRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                        style={{ color: 'var(--accent-blue)' }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {data?.total_pages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-outline py-2 px-4 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Page {page} of {data.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={page === data.total_pages}
                  className="btn-outline py-2 px-4 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
