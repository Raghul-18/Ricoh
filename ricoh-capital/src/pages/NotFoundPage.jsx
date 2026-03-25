import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

function getHomePath(profile) {
  if (!profile) return '/login';
  if (profile.role === 'admin') return '/admin';
  if (profile.role === 'customer') return '/portal/dashboard';
  if (profile.role === 'originator' && profile.onboarding_status === 'approved') return '/portfolio';
  return '/onboarding/registration';
}

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: 400, padding: 40,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileQuestion size={28} color="var(--tx4)" />
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx1)', marginBottom: 8 }}>Page not found</div>
        <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 28, lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or has been moved.
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate(getHomePath(profile))}
          style={{ justifyContent: 'center' }}
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
