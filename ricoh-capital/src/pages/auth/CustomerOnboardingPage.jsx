import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { LoadingSpinner } from '../../components/shared/FormField';

function useToken() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
}

export default function CustomerOnboardingPage() {
  const token = useToken();
  const navigate = useNavigate();
  const { signInWithOnboardingToken } = useAuth();
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let active = true;
    if (!token) {
      setState({ loading: false, error: 'This onboarding link is invalid or incomplete.' });
      return undefined;
    }

    signInWithOnboardingToken(token)
      .then((result) => {
        if (!active) return;
        navigate(result.redirect_path || `/portal/contracts/${result.contract_id}`, { replace: true });
      })
      .catch((error) => {
        if (!active) return;
        setState({ loading: false, error: error.message || 'This onboarding link is invalid or expired.' });
      });

    return () => {
      active = false;
    };
  }, [navigate, signInWithOnboardingToken, token]);

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <ShieldCheck size={18} style={{ color: 'var(--coral)' }} />
          <div style={{ fontWeight: 700, fontSize: 18 }}>Secure contract access</div>
        </div>
        {state.loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--tx3)' }}>
            <LoadingSpinner size={16} />
            Validating your onboarding link and opening your contract...
          </div>
        ) : (
          <>
            <div className="info-banner" style={{ borderColor: 'var(--amber)', background: 'var(--amber-l)', marginBottom: 14 }}>
              <Mail size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <div style={{ fontSize: 12 }}>
                {state.error}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
