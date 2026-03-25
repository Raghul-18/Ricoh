import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, Clock, Loader, Info, AlertTriangle, Upload, Sparkles, RefreshCw, ArrowRight,
} from 'lucide-react';
import { useApplication, useVerificationChecks } from '../../hooks/useOnboarding';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuth } from '../../auth/AuthContext';
import { LoadingSpinner } from '../../components/shared/FormField';

function StatusIcon({ status }) {
  if (status === 'passed')  return <CheckCircle size={14} style={{ color: 'var(--green)' }} />;
  if (status === 'failed')  return <XCircle size={14} style={{ color: 'var(--red)' }} />;
  if (status === 'running') return <LoadingSpinner size={12} />;
  return <Clock size={14} style={{ color: 'var(--tx4)' }} />;
}

const STATUS_META = {
  queued:  { label: 'Queued',   color: 'var(--tx4)',  ring: 'var(--bdr)' },
  running: { label: 'Running',  color: 'var(--blue)', ring: 'var(--blue)' },
  passed:  { label: 'Passed',   color: 'var(--green)',ring: 'var(--green)' },
  failed:  { label: 'Failed',   color: 'var(--red)',  ring: 'var(--red)' },
};

export default function P03Verification() {
  const navigate = useNavigate();
  const { refreshProfile, isApproved } = useAuth();
  const { applicationId } = useOnboardingStore();
  const redirected = useRef(false);

  // Poll application row so we notice when admin approves (trigger updates profile too)
  const { data: app, refetch: refetchApp } = useApplication({ refetchInterval: 8000, refetchOnWindowFocus: true });
  const appId = applicationId || app?.id;
  const { data: checks = [], isLoading, refetch: refetchChecks } = useVerificationChecks(appId);

  const total   = checks.length;
  const passed  = checks.filter(c => c.status === 'passed').length;
  const failed  = checks.filter(c => c.status === 'failed').length;
  const running = checks.filter(c => c.status === 'running').length;
  const queued  = checks.filter(c => c.status === 'queued').length;
  const allDone = total > 0 && queued === 0 && running === 0;
  const pct     = total ? Math.round((passed + failed) / total * 100) : 0;

  const appApproved = app?.status === 'approved' || isApproved;
  const appRejected = app?.status === 'rejected';

  // When application (or profile) is approved, sync session and go to welcome — unblocks the flow
  useEffect(() => {
    if (redirected.current) return;
    if (!appApproved) return;
    redirected.current = true;
    (async () => {
      await refreshProfile();
      navigate('/onboarding/welcome', { replace: true });
    })();
  }, [appApproved, app?.status, isApproved, navigate, refreshProfile]);

  const handleRefreshStatus = async () => {
    await Promise.all([refetchApp(), refetchChecks(), refreshProfile()]);
  };

  const subtitle = appApproved
    ? 'Redirecting you to the next step…'
    : appRejected
      ? 'Your application has been reviewed'
      : allDone && !failed && app?.status === 'under_review'
        ? 'All verification checks are complete — awaiting final account approval'
        : 'A compliance officer is reviewing your application and documents';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Verification Status</div>
          <div className="page-sub">{subtitle}</div>
        </div>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleRefreshStatus}>
          <RefreshCw size={14} /> Refresh status
        </button>
      </div>

      <div className="steps-row" style={{ marginBottom: 24 }}>
        {['Registration', 'Documents', 'Verification', 'Review', 'Welcome'].map((s, i) => (
          <div key={s} className={`step ${i === 2 ? 'active' : i < 2 ? 'done' : ''}`}>
            <div className="step-dot">{i < 2 ? <CheckCircle size={14} /> : i + 1}</div>
            <div className="step-label">{s}</div>
          </div>
        ))}
      </div>

      {appRejected && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--red-m)', background: 'var(--red-l)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--red)', marginBottom: 8 }}>Application not approved</div>
          <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 }}>
            {app?.rejection_reason || app?.admin_notes || 'Please contact support@zorocapital.com for more information.'}
          </div>
        </div>
      )}

      {/* Approved — brief state while redirect runs */}
      {appApproved && (
        <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: '28px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--green)' }}>
            <Sparkles size={40} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>You&apos;re approved</div>
          <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 8 }}>
            Taking you to your welcome screen… If nothing happens, use the button below.
          </div>
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/onboarding/welcome', { replace: true })}>
            Continue to welcome <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Overall progress — hide duplicate celebration when already approved */}
      {!appApproved && !appRejected && (
        <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: !allDone ? 'var(--blue)' : failed > 0 ? 'var(--amber)' : 'var(--green)' }}>
            {!allDone ? <Loader size={40} /> : failed > 0 ? <AlertTriangle size={40} /> : <CheckCircle size={40} />}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {!allDone ? (running > 0 ? 'Checks in progress…' : 'Awaiting verification checks') : failed > 0 ? 'Issues found' : (app?.status === 'under_review' ? 'Checks complete — approval pending' : 'All checks passed')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 18 }}>
            {passed} passed · {failed} failed · {queued + running} pending
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 99, height: 8, width: '100%', maxWidth: 320, margin: '0 auto', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, transition: '1s', background: failed > 0 ? 'var(--amber)' : 'var(--green)', width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 8 }}>{pct}% complete</div>
        </div>
      )}

      {isLoading ? (
        <div className="page-loading"><LoadingSpinner size={24} /></div>
      ) : total === 0 && !appRejected ? (
        <div className="info-banner amber">
          <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <div style={{ fontSize: 12 }}>
            Verification checks have not been started yet. A reviewer will open your application soon, or return here after you&apos;ve submitted your documents.
          </div>
          <button type="button" className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={() => navigate('/onboarding/documents')}>
            Go to documents
          </button>
        </div>
      ) : !appApproved && !appRejected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checks.map(check => {
            const meta = STATUS_META[check.status] || STATUS_META.queued;
            return (
              <div key={check.id} style={{
                background: 'var(--surface)', border: '1px solid var(--bdr)',
                borderRadius: 'var(--rl)', padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  border: `2px solid ${meta.ring}33`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${meta.ring}10`,
                }}>
                  <StatusIcon status={check.status} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{check.display_name}</div>
                  {check.result_detail && (
                    <div style={{ fontSize: 11, marginTop: 3, color: check.status === 'failed' ? 'var(--red)' : 'var(--tx3)' }}>
                      {check.result_detail}
                    </div>
                  )}
                  {check.checked_at && (
                    <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 2 }}>
                      {new Date(check.checked_at).toLocaleTimeString()}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: meta.color, fontWeight: 600, background: `${meta.ring}15`, borderRadius: 10, padding: '3px 8px', flexShrink: 0 }}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {!appApproved && !appRejected && (
        <div className="info-banner blue" style={{ marginTop: 20 }}>
          <Info size={15} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.7 }}>
            When a reviewer <strong>approves your application</strong>, you&apos;ll be moved to the welcome step automatically (this page checks every few seconds). You can also click <strong>Refresh status</strong> after you receive a notification.
          </div>
        </div>
      )}

      {!appApproved && allDone && failed > 0 && (
        <div style={{ marginTop: 20, padding: '16px', background: 'var(--red-l)', border: '1px solid var(--red-m)', borderRadius: 'var(--rl)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <XCircle size={14} /> Some checks require attention
          </div>
          <div style={{ fontSize: 12, color: 'var(--tx2)', marginBottom: 14, lineHeight: 1.6 }}>
            One or more verification checks failed. Please re-upload the affected documents if requested.
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/onboarding/documents')}>
            <Upload size={13} /> Re-upload documents
          </button>
        </div>
      )}
    </div>
  );
}
