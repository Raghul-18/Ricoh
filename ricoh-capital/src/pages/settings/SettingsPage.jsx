import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CheckCircle, Languages, Lock, User } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { authClient, db } from '../../lib/backendClient';
import { useAppContext } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';
import { FormField, LoadingSpinner } from '../../components/shared/FormField';
import { passwordSchema, profileSchema } from '../../schemas';

function ProfileSection({ profile, onSave }) {
  const [saving, setSaving] = useState(false);
  const { showToast } = useAppContext();
  const { t } = useLocale();

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      company_name: profile?.company_name || '',
    },
  });

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const { error } = await db.profiles()
        .update({ full_name: data.full_name, company_name: data.company_name || null })
        .eq('id', profile.id);
      if (error) throw error;
      await onSave();
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <User size={15} style={{ color: 'var(--coral)' }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.profile')}</div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Full name" required error={errors.full_name?.message}>
          <input {...register('full_name')} className="form-input" placeholder="Jane Smith" />
        </FormField>
        <FormField label="Email address" hint="Email cannot be changed here - contact support">
          <input className="form-input" value={profile?.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
        </FormField>
        {(profile?.role === 'originator' || profile?.role === 'admin') && (
          <FormField label="Company name" error={errors.company_name?.message}>
            <input {...register('company_name')} className="form-input" placeholder="Acme Finance Ltd" />
          </FormField>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving || !isDirty}>
          {saving ? <><LoadingSpinner size={12} /> Saving...</> : t('common.saveChanges')}
        </button>
      </form>
    </div>
  );
}

function PreferenceSection() {
  const [saving, setSaving] = useState(false);
  const { showToast } = useAppContext();
  const { locale, primaryCurrency, supportedLocales, setPreferences, t } = useLocale();
  const current = supportedLocales.find((entry) => entry.locale === locale) || supportedLocales[0];
  const currencies = [...new Set(supportedLocales.map((entry) => entry.currency))];

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextLocale = form.get('locale_code');
    const nextConfig = supportedLocales.find((entry) => entry.locale === nextLocale) || current;
    setSaving(true);
    try {
      await setPreferences({
        locale: nextConfig.locale,
        language: nextConfig.language,
        currency: form.get('primary_currency_code'),
      });
      showToast(t('settings.saved'), 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Languages size={15} style={{ color: 'var(--coral)' }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.preferences')}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx4)', marginBottom: 16 }}>
        {t('settings.autoDetected')}
      </div>
      <form onSubmit={handleSubmit}>
        <FormField label={t('common.language')}>
          <select name="locale_code" className="form-input" defaultValue={locale}>
            {supportedLocales.map((entry) => (
              <option key={entry.locale} value={entry.locale}>{entry.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('common.currency')}>
          <select name="primary_currency_code" className="form-input" defaultValue={primaryCurrency}>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </FormField>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><LoadingSpinner size={12} /> Saving...</> : t('common.saveChanges')}
        </button>
      </form>
    </div>
  );
}

function PasswordSection() {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { showToast } = useAppContext();
  const { t } = useLocale();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const { error } = await authClient.updateUser({
        password: data.newPassword,
        data: { needs_password_setup: false },
      });
      if (error) throw error;
      reset();
      setDone(true);
      showToast('Password updated successfully', 'success');
      setTimeout(() => setDone(false), 4000);
    } catch (err) {
      showToast(err.message || 'Failed to update password', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Lock size={15} style={{ color: 'var(--coral)' }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.setPassword')}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx4)', marginBottom: 16 }}>
        Choose a new password. You must be logged in to change it.
      </div>
      {done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: 'var(--green)' }}>
          <CheckCircle size={18} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Password updated successfully</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="New password" required error={errors.newPassword?.message} hint="Min 8 characters, 1 uppercase, 1 number">
            <input {...register('newPassword')} className="form-input" type="password" autoComplete="new-password" autoFocus />
          </FormField>
          <FormField label="Confirm new password" required error={errors.confirmPassword?.message}>
            <input {...register('confirmPassword')} className="form-input" type="password" autoComplete="new-password" />
          </FormField>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><LoadingSpinner size={12} /> Updating...</> : t('settings.setPassword')}
          </button>
        </form>
      )}
    </div>
  );
}

function AccountInfoSection({ profile }) {
  const { formatDate, t } = useLocale();

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Building2 size={15} style={{ color: 'var(--coral)' }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t('settings.account')}</div>
      </div>
      {[
        ['Role', profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '-'],
        ['Member since', profile?.created_at ? formatDate(profile.created_at, { day: 'numeric', month: 'long', year: 'numeric' }) : '-'],
        ['Account status', profile?.role === 'originator'
          ? { approved: 'Active', pending: 'Pending onboarding', under_review: 'Under review', rejected: 'Rejected' }[profile.onboarding_status] || 'Active'
          : 'Active'],
        ['Avatar initials', profile?.avatar_initials || '-'],
      ].map(([key, value]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 8, borderBottom: '1px solid var(--bdr)', marginBottom: 8 }}>
          <span style={{ color: 'var(--tx3)' }}>{key}</span>
          <span style={{ fontWeight: 500 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useLocale();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('settings.title')}</div>
          <div className="page-sub">{t('settings.subtitle')}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <ProfileSection profile={profile} onSave={refreshProfile} />
          <PreferenceSection />
          <PasswordSection />
        </div>
        <div>
          <AccountInfoSection profile={profile} />
        </div>
      </div>
    </div>
  );
}
