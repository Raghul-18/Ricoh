import { useEffect, useMemo, useRef, useState } from 'react';
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
  const consumeStartedRef = useRef(false);
  const outcomeHandledRef = useRef(false);
  const signInWithTokenRef = useRef(signInWithOnboardingToken);

  useEffect(() => {
    signInWithTokenRef.current = signInWithOnboardingToken;
  }, [signInWithOnboardingToken]);

  useEffect(() => {
    if (!token) {
      console.error('[CustomerOnboardingPage] missing onboarding token in URL');
      setState({ loading: false, error: 'This onboarding link is invalid or incomplete.' });
      return undefined;
    }
    if (consumeStartedRef.current) {
      console.warn('[CustomerOnboardingPage] token consume already started, skipping duplicate call');
      return undefined;
    }
    consumeStartedRef.current = true;
    console.log('[CustomerOnboardingPage] consuming onboarding token', {
      tokenLength: token.length,
      tokenPreview: token.slice(0, 8),
    });

    signInWithTokenRef.current(token)
      .then((result) => {
        if (outcomeHandledRef.current) return;
        outcomeHandledRef.current = true;
        const targetPath = result.redirect_path || `/portal/contracts/${result.contract_id}`;
        console.log('[CustomerOnboardingPage] onboarding consume success', {
          result,
          targetPath,
        });
        console.log('[CustomerOnboardingPage] redirecting to contract page', { targetPath });
        window.location.replace(targetPath);
      })
      .catch((error) => {
        if (outcomeHandledRef.current) return;
        outcomeHandledRef.current = true;
        console.error('[CustomerOnboardingPage] onboarding consume failed', {
          tokenLength: token.length,
          tokenPreview: token.slice(0, 8),
          error,
          message: error.message,
        });
        setState({ loading: false, error: error.message || 'This onboarding link is invalid or expired.' });
      });

    return undefined;
  }, [navigate, token]);

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
