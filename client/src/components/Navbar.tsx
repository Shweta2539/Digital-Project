import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Search, AlertTriangle, Zap, Menu, X, LogOut, User, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useUIStore, useAuthStore } from '../store';

const NAV_LINKS = [
  { to: '/', label: 'Threat Radar', icon: Zap },
  { to: '/scan', label: 'AI Scanner', icon: AlertTriangle },
  { to: '/companies', label: 'Companies', icon: Shield },
  { to: '/report', label: 'Report Scam', icon: AlertTriangle },
  { to: '/verify-employer', label: 'Verify Business', icon: Shield },
];

// Simulated trending scam alerts for the ticker
const TICKER_ALERTS = [
  '⚠ ALERT: "Amazon Work From Home" advance fee scam reported in 47 cities',
  '🔴 CRITICAL: Fake @google-careers-inc.com phishing campaign active',
  '⚠ HIGH: WhatsApp-only interview scam targeting remote job seekers',
  '🔴 CRITICAL: Fake check scam via "TaskRabbit recruiter" reported 23x this week',
  '⚠ HIGH: Zelle equipment fee scam — $250-$500 per victim loss',
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useUIStore();
  const { user, signOut } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/companies?search=${encodeURIComponent(searchQuery.trim())}`);
      closeMobileMenu();
    }
  };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      {/* Threat Alert Ticker */}
      <div
        style={{ background: 'rgba(255, 59, 92, 0.08)', borderBottom: '1px solid rgba(255, 59, 92, 0.2)' }}
        className="overflow-hidden py-1.5"
        aria-label="Live scam alert ticker"
      >
        <div className="flex items-center gap-3 px-4">
          <div
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: 'rgba(255,59,92,0.2)', color: '#ff3b5c' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            LIVE
          </div>
          <div className="overflow-hidden flex-1">
            <div className="ticker-content text-xs" style={{ color: 'var(--text-secondary)' }}>
              {TICKER_ALERTS.join('   •   ')}
            </div>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(5, 8, 20, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2.5 flex-shrink-0"
              onClick={closeMobileMenu}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #638bff 0%, #22d3ee 100%)' }}
              >
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-lg gradient-text" style={{ fontFamily: 'Space Grotesk' }}>
                  VeriJob
                </span>
                <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>
                  AI
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(to)
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'hover:text-blue-300 hover:bg-white/5'
                  }`}
                  style={{ color: isActive(to) ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Search + CTA */}
            <div className="hidden md:flex items-center gap-3">
              <form onSubmit={handleSearch} className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search company..."
                  className="pl-8 pr-4 py-1.5 text-sm rounded-lg w-44 outline-none"
                  style={{
                    background: 'rgba(99, 139, 255, 0.06)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontFamily: 'Inter',
                  }}
                />
              </form>

              <Link
                to="/scan"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: 'linear-gradient(135deg, #ff3b5c, #ff6b35)',
                  color: 'white',
                }}
              >
                <Zap size={14} />
                Scan Now
              </Link>

              {user ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(99,139,255,0.2)', color: 'var(--accent-blue)' }}
                  >
                    <User size={14} />
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                    title="Sign out"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : null}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden"
            style={{
              background: 'rgba(5, 8, 20, 0.98)',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div className="px-4 py-4 space-y-1">
              {/* Mobile search */}
              <form onSubmit={handleSearch} className="relative mb-3">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search company..."
                  className="w-full pl-8 pr-4 py-2 text-sm rounded-lg outline-none"
                  style={{
                    background: 'rgba(99, 139, 255, 0.06)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
              </form>

              {NAV_LINKS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={closeMobileMenu}
                  className="flex items-center justify-between px-4 py-3 rounded-lg transition-all"
                  style={{
                    background: isActive(to) ? 'rgba(99,139,255,0.1)' : 'transparent',
                    color: isActive(to) ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    <span className="font-medium">{label}</span>
                  </div>
                  <ChevronRight size={14} />
                </Link>
              ))}

              <Link
                to="/scan"
                onClick={closeMobileMenu}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold mt-3"
                style={{ background: 'linear-gradient(135deg, #ff3b5c, #ff6b35)', color: 'white' }}
              >
                <Zap size={16} />
                Scan Offer Now
              </Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
