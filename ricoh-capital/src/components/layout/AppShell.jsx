import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, X } from 'lucide-react';
import TopNav from './TopNav';
import LeftNav from './LeftNav';
import Toast from '../shared/Toast';
import Modal from '../shared/Modal';
import Confetti from '../shared/Confetti';
import { useAuth } from '../../auth/AuthContext';
import { useLocale } from '../../context/LocaleContext';

export default function AppShell() {
  const { user } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nav-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [navOpen, setNavOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const needsPasswordSetup = !bannerDismissed && user?.user_metadata?.needs_password_setup === true;

  useEffect(() => {
    localStorage.setItem('nav-collapsed', collapsed);
  }, [collapsed]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const handleNavToggle = useCallback(() => {
    if (window.innerWidth <= 1024) {
      setNavOpen((open) => !open);
    } else {
      setCollapsed((value) => !value);
    }
  }, []);

  return (
    <div className="app-shell">
      <Confetti />

      {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}

      <LeftNav
        collapsed={collapsed}
        navOpen={navOpen}
        onToggle={handleNavToggle}
        onClose={() => setNavOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopNav onMenuToggle={handleNavToggle} />

        {needsPasswordSetup && (
          <div
            style={{
              background: 'var(--amber-l)',
              borderBottom: '1px solid #fde68a',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <KeyRound size={14} color="var(--amber)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--tx2)', flex: 1, minWidth: 200 }}>
              <strong>{t('appShell.setPasswordTitle')}</strong> - {t('appShell.setPasswordBody')}
            </span>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: '4px 12px', flexShrink: 0 }}
              onClick={() => navigate('/settings')}
            >
              {t('settings.setPassword')}
            </button>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx4)', padding: 4, display: 'flex' }}
              onClick={() => setBannerDismissed(true)}
              aria-label={t('common.close')}
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
