import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, CheckCircle, KeyRound } from 'lucide-react';
import { authClient } from '../../lib/backendClient';
import { FormField, LoadingSpinner } from '../../components/shared/FormField';
import { RicohWordmark } from '../../components/shared/RicohLogo';
import { passwordSchema, resetPasswordRequestSchema } from '../../schemas';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('request'); // 'request' | 'sent' | 'reset' | 'done'
  const [serverError, setServerError] = useState('');
  const [isExchangingRecoveryCode, setIsExchangingRecoveryCode] = useState(false);

  const withTimeout = async (promise, timeoutMs = 15000) => {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  };

  useEffect(() => {
    // Detect ?type=recovery in query params
    const initializeRecovery = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('type') !== 'recovery') return;

      setMode('reset');
      setIsExchangingRecoveryCode(true);
      try {
        const code = params.get('code');
        if (code) {
          // PKCE recovery links include a code that must be exchanged for a session.
          const { error } = await withTimeout(authClient.exchangeCodeForSession(code));
          if (error) throw error;
        }
      } catch (err) {
        setServerError(err.message || 'Recovery link is invalid or expired. Please request a new reset email.');
      } finally {
        setIsExchangingRecoveryCode(false);
      }
    };

    initializeRecovery();
  }, []);

  useEffect(() => {
    // Detect PASSWORD_RECOVERY auth event (implicit/hash flow)
    const { data: { subscription } } = authClient.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const requestForm = useForm({ resolver: zodResolver(resetPasswordRequestSchema) });
  const resetForm = useForm({ resolver: zodResolver(passwordSchema) });

  const onRequestSubmit = async ({ email }) => {
    setServerError('');
    try {
      const { error } = await authClient.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/forgot-password`,
      });
      if (error) throw error;
      setMode('sent');
    } catch (err) {
      setServerError(err.message || 'Failed to send reset email. Please try again.');
    }
  };

  const onResetSubmit = async ({ newPassword }) => {
    setServerError('');
    try {
      const { data: { session } } = await withTimeout(authClient.getSession());
      if (!session) {
        throw new Error('Recovery session not found. Please open the latest reset link from your email.');
      }

      const { error } = await withTimeout(authClient.updateUser({
        password: newPassword,
        data: { needs_password_setup: false },
      }));
      if (error) throw error;
      setMode('done');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setServerError(err.message || 'Failed to update password. Your reset link may have expired.');
    }
  };

  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <RicohWordmark size={34} gap={11} fontSize={17} />
        </div>

        <div className="auth-card">

          {/* ── Step 1: Request reset ── */}
          {mode === 'request' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <KeyRound size={18} color="var(--coral)" />
                <div className="auth-title" style={{ margin: 0 }}>Reset your password</div>
              </div>
              <div className="auth-sub" style={{ marginBottom: 20 }}>
                Enter your email and we'll send you a reset link.
              </div>

              {serverError && (
                <div className="info-banner red" style={{ marginBottom: 16 }}>
                  <span>✕</span>
                  <div style={{ fontSize: 12, color: 'var(--red)' }}>{serverError}</div>
                </div>
              )}

              <form onSubmit={requestForm.handleSubmit(onRequestSubmit)}>
                <FormField label="Email address" required error={requestForm.formState.errors.email?.message}>
                  <input
                    {...requestForm.register('email')}
                    className="form-input"
                    type="email"
                    placeholder="you@company.com"
                    autoFocus
                  />
                </FormField>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', height: 40 }}
                  disabled={requestForm.formState.isSubmitting}
                >
                  {requestForm.formState.isSubmitting ? <LoadingSpinner /> : 'Send reset link →'}
                </button>
              </form>

              <div style={{ borderTop: '1px solid var(--bdr)', marginTop: 20, paddingTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--tx3)' }}>
                <Link to="/login" className="auth-link">← Back to sign in</Link>
              </div>
            </>
          )}

          {/* ── Step 2: Email sent ── */}
          {mode === 'sent' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={24} color="var(--blue)" />
                </div>
              </div>
              <div className="auth-title">Check your email</div>
              <div className="auth-sub" style={{ marginBottom: 24 }}>
                We've sent a password reset link to your email. Click the link to set a new password.
                <br /><br />
                <span style={{ fontSize: 11 }}>Didn't get it? Check your spam folder or&nbsp;
                  <button
                    onClick={() => setMode('request')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--coral)', fontSize: 11, fontWeight: 600, padding: 0 }}
                  >
                    try again
                  </button>.
                </span>
              </div>
              <Link to="/login" className="auth-link" style={{ fontSize: 12 }}>← Back to sign in</Link>
            </div>
          )}

          {/* ── Step 3: Set new password (after clicking email link) ── */}
          {mode === 'reset' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <KeyRound size={18} color="var(--coral)" />
                <div className="auth-title" style={{ margin: 0 }}>Set new password</div>
              </div>
              <div className="auth-sub" style={{ marginBottom: 20 }}>
                Choose a strong password for your account.
              </div>

              {serverError && (
                <div className="info-banner red" style={{ marginBottom: 16 }}>
                  <span>✕</span>
                  <div style={{ fontSize: 12, color: 'var(--red)' }}>{serverError}</div>
                </div>
              )}

              <form onSubmit={resetForm.handleSubmit(onResetSubmit)}>
                <FormField
                  label="New password"
                  required
                  error={resetForm.formState.errors.newPassword?.message}
                  hint="Min. 8 characters, 1 uppercase, 1 number"
                >
                  <input
                    {...resetForm.register('newPassword')}
                    className="form-input"
                    type="password"
                    placeholder="New password"
                    autoFocus
                  />
                </FormField>
                <FormField label="Confirm password" required error={resetForm.formState.errors.confirmPassword?.message}>
                  <input
                    {...resetForm.register('confirmPassword')}
                    className="form-input"
                    type="password"
                    placeholder="Confirm new password"
                  />
                </FormField>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', height: 40 }}
                  disabled={resetForm.formState.isSubmitting || isExchangingRecoveryCode}
                >
                  {(resetForm.formState.isSubmitting || isExchangingRecoveryCode) ? <LoadingSpinner /> : 'Update password →'}
                </button>
              </form>
            </>
          )}

          {/* ── Step 4: Done ── */}
          {mode === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--green-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={24} color="var(--green)" />
                </div>
              </div>
              <div className="auth-title">Password updated</div>
              <div className="auth-sub">
                Your password has been changed. Redirecting you to sign in…
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
