import { useNavigate } from 'react-router-dom';
import { ShieldOff, LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ZoroWordmark } from '../../components/shared/ZoroLogo';

export default function AccountDeactivatedPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <ZoroWordmark size={34} gap={11} fontSize={17} />
        </div>

        <div className="auth-card" style={{ padding: '40px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--red-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldOff size={26} color="var(--red)" />
            </div>
          </div>

          <div className="auth-title">Account deactivated</div>
          <div className="auth-sub" style={{ marginBottom: 28 }}>
            Your account has been deactivated by an administrator. If you believe this is a mistake, please contact your account manager or reach out to support.
          </div>

          <div style={{ background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)', padding: '12px 16px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: 'var(--tx4)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Need help?</div>
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Email <strong>support@zorocapital.com</strong> or call <strong>0800 000 0000</strong></div>
          </div>

          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', gap: 8 }}
            onClick={handleSignOut}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
