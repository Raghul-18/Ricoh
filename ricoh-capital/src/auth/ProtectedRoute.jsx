import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useOnboardingStore } from '../store/onboardingStore';

export function ProtectedRoute({ children, roles, requireApproved = false }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, background: 'var(--coral)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 auto 12px' }}>ZC</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to={getDefaultPath(profile)} replace />;
  }

  if (requireApproved && profile?.role === 'originator' && profile?.onboarding_status !== 'approved') {
    return <Navigate to={getOnboardingPath(profile?.onboarding_status)} replace />;
  }

  return children;
}


// Redirect unauthenticated users to login, authenticated to their home
export function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Loading…</div>
      </div>
    );
  }

  if (user && profile) {
    return <Navigate to={getDefaultPath(profile)} replace />;
  }

  return children;
}

function getDefaultPath(profile) {
  if (!profile) return '/login';
  switch (profile.role) {
    case 'admin':     return '/admin';
    case 'customer':  return '/portal/dashboard';
    case 'originator':
      if (profile.onboarding_status === 'approved') return '/portfolio';
      return getOnboardingPath(profile.onboarding_status);
    default:          return '/login';
  }
}

function getOnboardingPath(status) {
  switch (status) {
    case 'approved':       return '/onboarding/welcome';
    case 'rejected':       return '/onboarding/verification';
    case 'under_review':   return '/onboarding/verification';
    case 'info_requested': return '/onboarding/documents';
    case 'submitted':      return '/onboarding/verification';
    case 'deactivated':    return '/account-deactivated';
    case 'pending': {
      // Resume to the furthest completed step using persisted Zustand state
      const { registration, documents } = useOnboardingStore.getState();
      const hasRegistration = !!(registration?.companyName && registration?.contactEmail);
      const hasAnyDoc = Object.values(documents).some(d => d.status === 'uploaded');
      if (hasAnyDoc)       return '/onboarding/documents';
      if (hasRegistration) return '/onboarding/documents';
      return '/onboarding/registration';
    }
    default:               return '/onboarding/registration';
  }
}
