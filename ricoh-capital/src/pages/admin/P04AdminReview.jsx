import { useState } from 'react';
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Building2, User, Info, Search, Eye, ShieldCheck,
} from 'lucide-react';
import { useAdminQueue, useReviewApplication, useRunVerificationChecks, useUpdateCheckStatus } from '../../hooks/useAdminQueue';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';
import DocumentViewer from '../../components/shared/DocumentViewer';

const STATUS_META = {
  draft:        { label: 'Draft',       color: 'var(--tx4)',   bg: 'var(--bg)' },
  submitted:    { label: 'Submitted',   color: 'var(--blue)',  bg: 'var(--blue-l)' },
  under_review: { label: 'In review',   color: 'var(--amber)', bg: 'var(--amber-l)' },
  approved:     { label: 'Approved',    color: 'var(--green)', bg: 'var(--green-l)' },
  rejected:     { label: 'Rejected',    color: 'var(--red)',   bg: 'var(--red-l)' },
  on_hold:      { label: 'On hold',     color: 'var(--tx3)',   bg: 'var(--bg)' },
};

const CHECK_STATUS_META = {
  queued:  { label: 'Queued',  color: 'var(--tx4)',   icon: <Clock size={12} /> },
  running: { label: 'Running', color: 'var(--blue)',  icon: <LoadingSpinner size={10} /> },
  passed:  { label: 'Passed',  color: 'var(--green)', icon: <CheckCircle size={12} /> },
  failed:  { label: 'Failed',  color: 'var(--red)',   icon: <XCircle size={12} /> },
};

function VerificationChecks({ checks, applicationId }) {
  const updateCheck = useUpdateCheckStatus();

  if (!checks?.length) return (
    <div style={{ fontSize: 12, color: 'var(--tx4)', padding: '8px 0' }}>No checks yet.</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
      {checks.map(check => {
        const meta = CHECK_STATUS_META[check.status] || CHECK_STATUS_META.queued;
        return (
          <div key={check.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6 }}>
            <div style={{ color: meta.color, flexShrink: 0 }}>{meta.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{check.display_name}</div>
              {check.result_detail && <div style={{ fontSize: 11, color: check.status === 'failed' ? 'var(--red)' : 'var(--tx3)', marginTop: 2 }}>{check.result_detail}</div>}
            </div>
            {/* Admin can manually override each check */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '2px 8px', color: 'var(--green)', border: '1px solid var(--green-m)', background: check.status === 'passed' ? 'var(--green-l)' : undefined }}
                onClick={() => updateCheck.mutateAsync({ id: check.id, applicationId, status: 'passed', detail: 'Manually verified by reviewer' })}
              >Pass</button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '2px 8px', color: 'var(--red)', border: '1px solid var(--red-m)', background: check.status === 'failed' ? 'var(--red-l)' : undefined }}
                onClick={() => updateCheck.mutateAsync({ id: check.id, applicationId, status: 'failed', detail: 'Failed manual review' })}
              >Fail</button>
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
  const [viewerDoc, setViewerDoc] = useState(null); // index into app.originator_documents
  const runChecks = useRunVerificationChecks();

  const sm = STATUS_META[app.status] || STATUS_META.submitted;
  const docs = app.originator_documents || [];
  const checks = app.verification_checks || [];
  const allChecksPassed = checks.length > 0 && checks.every(c => c.status === 'passed');
  const hasFailedChecks = checks.some(c => c.status === 'failed');

  const handleRunChecks = () => runChecks.mutateAsync(app.id);

  return (
    <>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
        {/* Card header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{app.company_name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: sm.color, background: sm.bg, borderRadius: 10, padding: '2px 8px' }}>{sm.label}</span>
              {allChecksPassed && <span style={{ fontSize: 10, color: 'var(--green)', background: 'var(--green-l)', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>All checks passed</span>}
              {hasFailedChecks && <span style={{ fontSize: 10, color: 'var(--red)', background: 'var(--red-l)', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>Checks failed</span>}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--tx3)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={10} />{app.company_reg_number || '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={10} />{app.profiles?.full_name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} />{new Date(app.created_at).toLocaleDateString('en-GB')}</span>
              <span>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setExpanded(e => !e)}>
            {expanded ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> Review</>}
          </button>
        </div>

        {expanded && (
          <div style={{ borderTop: '1px solid var(--bdr)', padding: '20px' }}>
            {/* Company details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                ['Reg. number', app.company_reg_number],
                ['Company type', app.company_type],
                ['Contact', app.profiles?.full_name],
                ['Email', app.profiles?.email],
                ['Job title', app.contact_job_title],
                ['Products', (app.product_lines || []).join(', ')],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{v || '—'}</div>
                </div>
              ))}
            </div>

            {/* Registered address */}
            {app.registered_address && (
              <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px', marginBottom: 16, fontSize: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--tx4)', marginBottom: 2 }}>Registered address</div>
                <div style={{ fontWeight: 500 }}>{app.registered_address}</div>
              </div>
            )}

            {/* Uploaded documents */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Documents ({docs.length})</span>
                {docs.length > 0 && (
                  <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setViewerDoc(0)}>
                    <Eye size={12} /> View all documents
                  </button>
                )}
              </div>
              {docs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--tx4)', padding: '8px 0' }}>No documents uploaded.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {docs.map((doc, i) => (
                    <button key={doc.id} onClick={() => setViewerDoc(i)} style={{
                      all: 'unset', cursor: 'pointer', fontSize: 11, padding: '5px 10px',
                      borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--bdr)',
                      color: 'var(--tx2)', display: 'flex', alignItems: 'center', gap: 5,
                      fontWeight: 500,
                    }}>
                      <Eye size={10} /> {doc.display_name || doc.document_type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Verification checks */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Verification checks ({checks.length})</span>
                {checks.length === 0 && (
                  <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={handleRunChecks} disabled={runChecks.isPending}>
                    {runChecks.isPending ? <><LoadingSpinner size={10} /> Running…</> : <><ShieldCheck size={12} /> Run checks</>}
                  </button>
                )}
              </div>
              <VerificationChecks checks={checks} applicationId={app.id} />
            </div>

            {/* Reviewer notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Reviewer notes</label>
              <textarea
                className="form-input"
                style={{ height: 72, fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Add decision notes or feedback for the originator…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {['submitted', 'under_review', 'on_hold'].includes(app.status) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onHold({ id: app.id, notes })}>
                  <Clock size={13} /> Put on hold
                </button>
                <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => onReject({ id: app.id, notes })}>
                  <XCircle size={13} /> Reject
                </button>
                <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => onApprove({ id: app.id, notes })}>
                  <CheckCircle size={13} /> Approve
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document viewer modal */}
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

  const handleApprove = async ({ id, notes }) => {
    try { await reviewMutation.mutateAsync({ id, status: 'approved', notes }); showToast('Application approved', 'success'); }
    catch (err) { showToast(err.message || 'Failed to approve', 'error'); }
  };
  const handleReject = async ({ id, notes }) => {
    try { await reviewMutation.mutateAsync({ id, status: 'rejected', notes }); showToast('Application rejected', 'success'); }
    catch (err) { showToast(err.message || 'Failed to reject', 'error'); }
  };
  const handleHold = async ({ id, notes }) => {
    try { await reviewMutation.mutateAsync({ id, status: 'on_hold', notes }); showToast('Application placed on hold', 'success'); }
    catch (err) { showToast(err.message || 'Failed', 'error'); }
  };

  const filtered = applications
    .filter(a => {
      if (filter === 'pending') return ['submitted', 'under_review'].includes(a.status);
      if (filter === 'all') return true;
      return a.status === filter;
    })
    .filter(a => {
      const q = search.toLowerCase();
      return !q || a.company_name?.toLowerCase().includes(q) || a.profiles?.email?.toLowerCase().includes(q);
    });

  const pendingCount = applications.filter(a => ['submitted', 'under_review'].includes(a.status)).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Review queue</div>
          <div className="page-sub">{pendingCount} pending review · {applications.length} total</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, height: 34, padding: '0 10px' }}>
          <Search size={13} style={{ color: 'var(--tx4)', flexShrink: 0 }} />
          <input style={{ all: 'unset', flex: 1, fontSize: 12 }} placeholder="Search company or email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {[['pending', 'Pending'], ['submitted', 'Submitted'], ['under_review', 'In review'], ['on_hold', 'On hold'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([v, l]) => (
          <button key={v} className={`btn ${filter === v ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 11, padding: '4px 12px', height: 32 }} onClick={() => setFilter(v)}>{l}
            {v === 'pending' && pendingCount > 0 && <span style={{ marginLeft: 5, background: 'var(--coral)', color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 5px' }}>{pendingCount}</span>}
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
            <div className="empty-state-title">Queue is clear</div>
            <div className="empty-state-sub">No applications match the current filter.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(app => (
            <AppCard key={app.id} app={app} onApprove={handleApprove} onReject={handleReject} onHold={handleHold} />
          ))}
        </div>
      )}
    </div>
  );
}
