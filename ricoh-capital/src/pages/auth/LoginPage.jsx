import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/AuthContext';
import { loginSchema } from '../../schemas';
import { FormField, LoadingSpinner } from '../../components/shared/FormField';
import { ZoroWordmark } from '../../components/shared/ZoroLogo';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, isAdmin, isOriginator, isCustomer, isApproved, needsOnboarding, profile } = useAuth();
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async ({ email, password }) => {
    setServerError('');
    try {
      await signIn(email, password);
      const from = location.state?.from?.pathname;

      // Redirect is handled in useEffect via AuthContext — but we also navigate eagerly
      // The ProtectedRoute / PublicRoute handles the redirect after profile loads
    } catch (err) {
      setServerError(err.message || 'Invalid email or password');
    }
  };

  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <ZoroWordmark size={34} gap={11} fontSize={17} />
        </div>

        <div className="auth-card">
          <div className="auth-title">Sign in</div>
          <div className="auth-sub">Sign in to your Zoro Capital account</div>

          {serverError && (
            <div className="info-banner red" style={{ marginBottom: 16 }}>
              <span>✕</span>
              <div style={{ fontSize: 12, color: 'var(--red)' }}>{serverError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <FormField label="Email address" required error={errors.email?.message}>
              <input
                {...register('email')}
                className="form-input"
                type="email"
                placeholder="you@company.com"
                autoFocus
              />
            </FormField>

            <FormField label="Password" required error={errors.password?.message}>
              <input
                {...register('password')}
                className="form-input"
                type="password"
                placeholder="Enter your password"
              />
            </FormField>

            <div style={{ textAlign: 'right', marginBottom: 20, marginTop: -6 }}>
              <Link to="/forgot-password" className="auth-link" style={{ fontSize: 11 }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: 40 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoadingSpinner /> : 'Sign in →'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid var(--bdr)', marginTop: 24, paddingTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--tx3)' }}>
            New originator?{' '}
            <Link to="/signup" className="auth-link">Create an account</Link>
          </div>
        </div>

        {/* Demo credentials helper */}
        <div style={{ marginTop: 20, background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--tx4)', letterSpacing: '.6px', marginBottom: 10 }}>Demo accounts</div>
          {[
            { role: 'Originator', email: 'james@acmefinance.co.uk',  password: 'Test123!' },
            { role: 'Admin',      email: 'admin@zorocapital.com',    password: 'Admin123!' },
            { role: 'Customer',   email: 'contact@techworks.co.uk',  password: 'Test123!' },
          ].map(d => (
            <div key={d.role} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
              <span className={`tag ${d.role === 'Originator' ? 'coral' : d.role === 'Admin' ? 'blue' : 'green'}`}>{d.role}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--tx2)', fontSize: 10 }}>{d.email}</span>
              <span style={{ color: 'var(--tx4)', fontSize: 10 }}>/ {d.password}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
