import { useState } from 'react';
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Building2, User, Search, Eye, ShieldCheck,
} from 'lucide-react';
import {
  useAdminQueue,
  useReviewApplication,
  useRunVerificationChecks,
  useUpdateCheckStatus,
} from '../../hooks/useAdminQueue';
import { useAppContext } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';
import { LoadingSpinner } from '../../components/shared/FormField';
import DocumentViewer from '../../components/shared/DocumentViewer';

const STATUS_META = {
  draft: { color: 'var(--tx4)', bg: 'var(--bg)', labelKey: 'admin.reviewStatusDraft', fallback: 'Draft' },
  submitted: { color: 'var(--blue)', bg: 'var(--blue-l)', labelKey: 'common.submitted', fallback: 'Submitted' },
  under_review: { color: 'var(--amber)', bg: 'var(--amber-l)', labelKey: 'common.inReview', fallback: 'In review' },
  approved: { color: 'var(--green)', bg: 'var(--green-l)', labelKey: 'common.approved', fallback: 'Approved' },
  rejected: { color: 'var(--red)', bg: 'var(--red-l)', labelKey: 'admin.reviewStatusRejected', fallback: 'Rejected' },
  on_hold: { color: 'var(--tx3)', bg: 'var(--bg)', labelKey: 'admin.reviewStatusOnHold', fallback: 'On hold' },
};

const CHECK_STATUS_META = {
  queued: { color: 'var(--tx4)', icon: <Clock size={12} />, labelKey: 'admin.reviewCheckQueued', fallback: 'Queued' },
  running: { color: 'var(--blue)', icon: <LoadingSpinner size={10} />, labelKey: 'admin.reviewCheckRunning', fallback: 'Running' },
  passed: { color: 'var(--green)', icon: <CheckCircle size={12} />, labelKey: 'admin.reviewCheckPassed', fallback: 'Passed' },
  failed: { color: 'var(--red)', icon: <XCircle size={12} />, labelKey: 'admin.reviewCheckFailed', fallback: 'Failed' },
};

function getText(t, key, fallback, values) {
  const translated = t(key, values);
  return translated === key ? fallback : translated;
}

function formatDisplayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value;
}

function VerificationChecks({ checks, applicationId }) {
  const updateCheck = useUpdateCheckStatus();
  const { t } = useLocale();

  if (!checks?.length) {
    return (
      <div style={{ fontSize: 12, color: 'var(--tx4)', padding: '8px 0' }}>
        {getText(t, 'admin.reviewNoChecks', 'No checks yet.')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
      {checks.map((check) => {
        const meta = CHECK_STATUS_META[check.status] || CHECK_STATUS_META.queued;
        return (
          <div key={check.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6 }}>
            <div style={{ color: meta.color, flexShrink: 0 }}>{meta.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{check.display_name}</div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                {getText(t, meta.labelKey, meta.fallback)}
              </div>
              {check.result_detail && (
                <div style={{ fontSize: 11, color: check.status === 'failed' ? 'var(--red)' : 'var(--tx3)', marginTop: 2 }}>
                  {check.result_detail}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                className="btn btn-ghost"
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  color: 'var(--green)',
                  border: '1px solid var(--green-m)',
                  background: check.status === 'passed' ? 'var(--green-l)' : undefined,
                }}
                onClick={() => updateCheck.mutateAsync({
                  id: check.id,
                  applicationId,
                  status: 'passed',
                  detail: getText(t, 'admin.reviewManualPassDetail', 'Manually verified by reviewer'),
                })}
              >
                {getText(t, 'admin.reviewPass', 'Pass')}
              </button>
              <button
                className="btn btn-ghost"
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  color: 'var(--red)',
                  border: '1px solid var(--red-m)',
                  background: check.status === 'failed' ? 'var(--red-l)' : undefined,
                }}
                onClick={() => updateCheck.mutateAsync({
                  id: check.id,
                  applicationId,
                  status: 'failed',
                  detail: getText(t, 'admin.reviewManualFailDetail', 'Failed manual review'),
                })}
              >
                {getText(t, 'admin.reviewFail', 'Fail')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AppCard({ app, onApprove, onReject, onHold }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(app.admin_notes || '');
  const [viewerDoc, setViewerDoc] = useState(null);
  const runChecks = useRunVerificationChecks();
  const { formatDate, t } = useLocale();

  const statusMeta = STATUS_META[app.status] || STATUS_META.submitted;
  const docs = app.originator_documents || [];
  const checks = app.verification_checks || [];
  const allChecksPassed = checks.length > 0 && checks.every((check) => check.status === 'passed');
  const hasFailedChecks = checks.some((check) => check.status === 'failed');

  return (
    <>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{app.company_name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: statusMeta.color, background: statusMeta.bg, borderRadius: 10, padding: '2px 8px' }}>
                {getText(t, statusMeta.labelKey, statusMeta.fallback)}
              </span>
              {allChecksPassed && (
                <span style={{ fontSize: 10, color: 'var(--green)', background: 'var(--green-l)', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
                  {getText(t, 'admin.reviewAllChecksPassed', 'All checks passed')}
                </span>
              )}
              {hasFailedChecks && (
                <span style={{ fontSize: 10, color: 'var(--red)', background: 'var(--red-l)', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
                  {getText(t, 'admin.reviewChecksFailed', 'Checks failed')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--tx3)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building2 size={10} />
                {app.company_reg_number || '—'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={10} />
                {app.profiles?.full_name || '—'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} />
                {formatDate(app.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span>
                {getText(t, 'admin.reviewDocumentsCount', '{count} documents', { count: docs.length })}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setExpanded((value) => !value)}>
            {expanded ? (
              <>
                <ChevronUp size={14} />
                {getText(t, 'admin.reviewCollapse', 'Collapse')}
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                {getText(t, 'admin.reviewOpen', 'Review')}
              </>
            )}
          </button>
        </div>

        {expanded && (
          <div style={{ borderTop: '1px solid var(--bdr)', padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                [getText(t, 'admin.reviewRegNumber', 'Reg. number'), app.company_reg_number],
                [getText(t, 'admin.reviewCompanyType', 'Company type'), app.company_type],
                [getText(t, 'admin.reviewContact', 'Contact'), app.profiles?.full_name],
                [getText(t, 'admin.reviewEmail', 'Email'), app.profiles?.email],
                [getText(t, 'admin.reviewJobTitle', 'Job title'), app.contact_job_title],
                [getText(t, 'admin.reviewProducts', 'Products'), app.product_lines],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{formatDisplayValue(value) || '—'}</div>
                </div>
              ))}
            </div>

            {app.registered_address && (
              <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px', marginBottom: 16, fontSize: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--tx4)', marginBottom: 2 }}>
                  {getText(t, 'admin.reviewRegisteredAddress', 'Registered address')}
                </div>
                <div style={{ fontWeight: 500 }}>{app.registered_address}</div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{getText(t, 'admin.reviewDocumentsSection', 'Documents ({count})', { count: docs.length })}</span>
                {docs.length > 0 && (
                  <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setViewerDoc(0)}>
                    <Eye size={12} />
                    {getText(t, 'admin.reviewViewAllDocuments', 'View all documents')}
                  </button>
                )}
              </div>
              {docs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--tx4)', padding: '8px 0' }}>
                  {getText(t, 'admin.reviewNoDocuments', 'No documents uploaded.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {docs.map((doc, index) => (
                    <button
                      key={doc.id}
                      onClick={() => setViewerDoc(index)}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '5px 10px',
                        borderRadius: 6,
                        background: 'var(--bg)',
                        border: '1px solid var(--bdr)',
                        color: 'var(--tx2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontWeight: 500,
                      }}
                    >
                      <Eye size={10} />
                      {doc.display_name || doc.document_type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{getText(t, 'admin.reviewChecksSection', 'Verification checks ({count})', { count: checks.length })}</span>
                {checks.length === 0 && (
                  <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => runChecks.mutateAsync(app.id)} disabled={runChecks.isPending}>
                    {runChecks.isPending ? (
                      <>
                        <LoadingSpinner size={10} />
                        {getText(t, 'admin.reviewRunningChecks', 'Running...')}
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={12} />
                        {getText(t, 'admin.reviewRunChecks', 'Run checks')}
                      </>
                    )}
                  </button>
                )}
              </div>
              <VerificationChecks checks={checks} applicationId={app.id} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                {getText(t, 'admin.reviewReviewerNotes', 'Reviewer notes')}
              </label>
              <textarea
                className="form-input"
                style={{ height: 72, fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder={getText(t, 'admin.reviewNotesPlaceholder', 'Add decision notes or feedback for the originator...')}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            {['submitted', 'under_review', 'on_hold'].includes(app.status) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onHold({ id: app.id, notes })}>
                  <Clock size={13} />
                  {getText(t, 'admin.reviewPutOnHold', 'Put on hold')}
                </button>
                <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => onReject({ id: app.id, notes })}>
                  <XCircle size={13} />
                  {getText(t, 'admin.reviewReject', 'Reject')}
                </button>
                <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => onApprove({ id: app.id, notes })}>
                  <CheckCircle size={13} />
                  {getText(t, 'admin.reviewApprove', 'Approve')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {viewerDoc !== null && docs.length > 0 && (
        <DocumentViewer
          documents={docs}
          initialIndex={viewerDoc}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </>
  );
}

export default function P04AdminReview() {
  const { showToast } = useAppContext();
  const { data: applications = [], isLoading, error } = useAdminQueue();
  const reviewMutation = useReviewApplication();
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const { t, formatNumber } = useLocale();

  const handleApprove = async ({ id, notes }) => {
    try {
      await reviewMutation.mutateAsync({ id, status: 'approved', notes });
      showToast(getText(t, 'admin.reviewApprovedToast', 'Application approved'), 'success');
    } catch (err) {
      showToast(err.message || getText(t, 'admin.reviewApproveFailed', 'Failed to approve'), 'error');
    }
  };

  const handleReject = async ({ id, notes }) => {
    try {
      await reviewMutation.mutateAsync({ id, status: 'rejected', notes });
      showToast(getText(t, 'admin.reviewRejectedToast', 'Application rejected'), 'success');
    } catch (err) {
      showToast(err.message || getText(t, 'admin.reviewRejectFailed', 'Failed to reject'), 'error');
    }
  };

  const handleHold = async ({ id, notes }) => {
    try {
      await reviewMutation.mutateAsync({ id, status: 'on_hold', notes });
      showToast(getText(t, 'admin.reviewHeldToast', 'Application placed on hold'), 'success');
    } catch (err) {
      showToast(err.message || getText(t, 'admin.reviewHoldFailed', 'Failed to update status'), 'error');
    }
  };

  const filtered = applications
    .filter((application) => {
      if (filter === 'pending') return ['submitted', 'under_review'].includes(application.status);
      if (filter === 'all') return true;
      return application.status === filter;
    })
    .filter((application) => {
      const query = search.toLowerCase();
      return !query
        || application.company_name?.toLowerCase().includes(query)
        || application.profiles?.email?.toLowerCase().includes(query);
    });

  const pendingCount = applications.filter((application) => ['submitted', 'under_review'].includes(application.status)).length;

  const filters = [
    ['pending', getText(t, 'admin.reviewFilterPending', 'Pending')],
    ['submitted', getText(t, 'common.submitted', 'Submitted')],
    ['under_review', getText(t, 'common.inReview', 'In review')],
    ['on_hold', getText(t, 'admin.reviewStatusOnHold', 'On hold')],
    ['approved', getText(t, 'common.approved', 'Approved')],
    ['rejected', getText(t, 'admin.reviewStatusRejected', 'Rejected')],
    ['all', getText(t, 'common.all', 'All')],
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{getText(t, 'admin.reviewQueueTitle', 'Review queue')}</div>
          <div className="page-sub">
            {getText(t, 'admin.reviewQueueSub', '{pending} pending review · {total} total', {
              pending: formatNumber(pendingCount),
              total: formatNumber(applications.length),
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, height: 34, padding: '0 10px' }}>
          <Search size={13} style={{ color: 'var(--tx4)', flexShrink: 0 }} />
          <input
            style={{ all: 'unset', flex: 1, fontSize: 12 }}
            placeholder={getText(t, 'admin.reviewSearchPlaceholder', 'Search company or email...')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {filters.map(([value, label]) => (
          <button
            key={value}
            className={`btn ${filter === value ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 11, padding: '4px 12px', height: 32 }}
            onClick={() => setFilter(value)}
          >
            {label}
            {value === 'pending' && pendingCount > 0 && (
              <span style={{ marginLeft: 5, background: 'var(--coral)', color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 5px' }}>
                {formatNumber(pendingCount)}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="page-loading"><LoadingSpinner size={24} /></div>
      ) : error ? (
        <div className="page-error">{error.message}</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--tx4)', marginBottom: 12 }}><CheckCircle size={40} /></div>
            <div className="empty-state-title">{getText(t, 'admin.reviewQueueClearTitle', 'Queue is clear')}</div>
            <div className="empty-state-sub">{getText(t, 'admin.reviewQueueClearSub', 'No applications match the current filter.')}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((app) => (
            <AppCard key={app.id} app={app} onApprove={handleApprove} onReject={handleReject} onHold={handleHold} />
          ))}
        </div>
      )}
    </div>
  );
}
