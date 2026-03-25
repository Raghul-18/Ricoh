import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/AuthContext';
import { signupSchema } from '../../schemas';
import { FormField, LoadingSpinner } from '../../components/shared/FormField';
import { ZoroWordmark } from '../../components/shared/ZoroLogo';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      companyName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async ({ fullName, companyName, email, password }) => {
    setServerError('');
    try {
      const { data } = await signUp({ email, password, fullName, companyName, role: 'originator' });
      // If email confirmation is enabled, show success message
      if (data?.user && !data?.session) {
        setSuccess(true);
      } else {
        navigate('/onboarding/registration');
      }
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.');
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--coral)' }}>✉</div>
          <div className="auth-title">Check your email</div>
          <div className="auth-sub" style={{ marginBottom: 0, lineHeight: 1.7 }}>
            We've sent a confirmation email to your address.<br />
            Click the link to activate your account and continue onboarding.
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: 'var(--tx3)' }}>
            Already confirmed?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <ZoroWordmark size={34} gap={11} fontSize={17} />
        </div>

        <div className="auth-card">
          <div className="auth-title">Create an account</div>
          <div className="auth-sub">Apply to become a Zoro Capital originator</div>

          {serverError && (
            <div className="info-banner red" style={{ marginBottom: 16 }}>
              <span>✕</span>
              <div style={{ fontSize: 12, color: 'var(--red)' }}>{serverError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <FormField label="Full name" required error={errors.fullName?.message}>
                <input {...register('fullName')} className="form-input" placeholder="Jane Smith" autoFocus />
              </FormField>
              <FormField label="Company name" required error={errors.companyName?.message}>
                <input {...register('companyName')} className="form-input" placeholder="Acme Finance Ltd" />
              </FormField>
            </div>

            <FormField label="Work email" required error={errors.email?.message}>
              <input {...register('email')} className="form-input" type="email" placeholder="jane@company.com" />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <FormField label="Password" required error={errors.password?.message}>
                <input {...register('password')} className="form-input" type="password" placeholder="8+ chars, 1 uppercase, 1 digit" />
              </FormField>
              <FormField label="Confirm password" required error={errors.confirmPassword?.message}>
                <input {...register('confirmPassword')} className="form-input" type="password" placeholder="Re-enter password" />
              </FormField>
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)', padding: '10px 12px', fontSize: 11, color: 'var(--tx3)', marginBottom: 16, lineHeight: 1.6 }}>
              By creating an account you agree to our{' '}
              <a href="#" className="auth-link">Terms of Business</a> and{' '}
              <a href="#" className="auth-link">Privacy Policy</a>.
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: 40 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoadingSpinner /> : 'Create account →'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid var(--bdr)', marginTop: 24, paddingTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--tx3)' }}>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
