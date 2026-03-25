import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, BarChart3, Users, FileText, ArrowRight } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useOnboardingStore } from '../../store/onboardingStore';

const FEATURES = [
  { icon: <FileText size={18} />, title: 'Submit deals', desc: 'Start submitting HP, finance lease and loan applications through the deal capture workflow' },
  { icon: <BarChart3 size={18} />, title: 'Monitor your portfolio', desc: 'Track all your active contracts, payment schedules and upcoming renewals in real time' },
  { icon: <Users size={18} />, title: 'Manage your pipeline', desc: 'Use the built-in CRM to track prospects from first contact to signed agreement' },
  { icon: <FileText size={18} />, title: 'Generate quotes', desc: 'Build professional multi-scenario quotes and send them directly to your clients' },
];

function onboardingPathForStatus(status) {
  switch (status) {
    case 'pending':        return '/onboarding/registration';
    case 'submitted':
    case 'info_requested': return '/onboarding/documents';
    case 'under_review':   return '/onboarding/verification';
    case 'rejected':       return '/onboarding/verification';
    default:               return '/onboarding/registration';
  }
}

export default function P05Welcome() {
  const navigate = useNavigate();
  const { profile, refreshProfile, isApproved, loading } = useAuth();
  const { reset } = useOnboardingStore();

  // Welcome is only for approved originators
  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== 'originator') return;
    if (isApproved) return;
    navigate(onboardingPathForStatus(profile.onboarding_status), { replace: true });
  }, [loading, profile, isApproved, navigate]);

  const handleEnter = async () => {
    reset();
    await refreshProfile();
    navigate('/portfolio');
  };

  const displayName = profile?.full_name?.split(' ')[0] || 'there';
  const companyName = profile?.company_name || 'your firm';

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 36, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, background: 'var(--green-l)', border: '2px solid var(--green-m)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={36} style={{ color: 'var(--green)' }} />
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: '-.4px', marginBottom: 10 }}>
          Welcome to Zoro Capital, {displayName}
        </div>
        <div style={{ fontSize: 14, color: 'var(--tx3)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--tx2)' }}>{companyName}</strong> has been approved and your originator account is now active.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>What you can do now</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {FEATURES.map((item, i) => (
            <div key={item.title} className="check-row">
              <div className="check-icon" style={{ background: 'var(--coral-l)', color: 'var(--coral)' }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="info-banner blue" style={{ marginBottom: 24 }}>
        <CheckCircle size={15} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.7 }}>
          Your dedicated relationship manager will be in touch within 24 hours. In the meantime, email <strong>support@zorocapital.com</strong> with any questions.
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button className="btn btn-primary" style={{ fontSize: 14, padding: '12px 32px' }} onClick={handleEnter}>
          Enter the portal <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
