import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, X } from 'lucide-react';
import TopNav from './TopNav';
import LeftNav from './LeftNav';
import Toast from '../shared/Toast';
import Modal from '../shared/Modal';
import Confetti from '../shared/Confetti';
import { useAuth } from '../../auth/AuthContext';

export default function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Desktop: sidebar collapsed/expanded
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('nav-collapsed') === 'true'; }
    catch { return false; }
  });

  // Mobile: nav open/closed
  const [navOpen, setNavOpen] = useState(false);

  const [bannerDismissed, setBannerDismissed] = useState(false);

  const needsPasswordSetup = !bannerDismissed && user?.user_metadata?.needs_password_setup === true;

  useEffect(() => {
    localStorage.setItem('nav-collapsed', collapsed);
  }, [collapsed]);

  // Close mobile nav on route change
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const handleNavToggle = useCallback(() => {
    // On mobile (≤ 1024px) toggle the overlay; on desktop toggle collapsed
    if (window.innerWidth <= 1024) {
      setNavOpen(o => !o);
    } else {
      setCollapsed(c => !c);
    }
  }, []);

  return (
    <div className="app-shell">
      <Confetti />

      {/* Mobile nav backdrop */}
      {navOpen && (
        <div className="nav-overlay" onClick={() => setNavOpen(false)} />
      )}

      <LeftNav
        collapsed={collapsed}
        navOpen={navOpen}
        onToggle={handleNavToggle}
        onClose={() => setNavOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopNav onMenuToggle={handleNavToggle} />

        {/* First-login password setup banner */}
        {needsPasswordSetup && (
          <div style={{
            background: 'var(--amber-l)', borderBottom: '1px solid #fde68a',
            padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
            flexWrap: 'wrap',
          }}>
            <KeyRound size={14} color="var(--amber)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--tx2)', flex: 1, minWidth: 200 }}>
              <strong>Set your password</strong> — you logged in with an invite link. Visit settings to set a permanent password.
            </span>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: '4px 12px', flexShrink: 0 }}
              onClick={() => navigate('/settings')}
            >
              Set password
            </button>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx4)', padding: 4, display: 'flex' }}
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          <Outlet />
        </main>
      </div>
      <Modal />
      <Toast />
    </div>
  );
}
