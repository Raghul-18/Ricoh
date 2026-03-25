import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, Search, ChevronDown, ChevronRight,
  User, FileText, Briefcase, CheckCircle, XCircle,
  FilePlus, Edit, Trash2, LogIn, Settings,
} from 'lucide-react';
import { db } from '../../lib/backendClient';
import { keys } from '../../lib/queryClient';
import { LoadingSpinner } from '../../components/shared/FormField';

const ENTITY_META = {
  deal:        { label: 'Deal',        icon: <Briefcase size={12} />,  color: 'var(--blue)' },
  contract:    { label: 'Contract',    icon: <FileText size={12} />,   color: 'var(--green)' },
  application: { label: 'Application', icon: <FilePlus size={12} />,   color: 'var(--amber)' },
  profile:     { label: 'Profile',     icon: <User size={12} />,       color: 'var(--coral)' },
  prospect:    { label: 'Prospect',    icon: <User size={12} />,       color: 'var(--tx3)' },
  quote:       { label: 'Quote',       icon: <FileText size={12} />,   color: 'var(--blue)' },
  auth:        { label: 'Auth',        icon: <LogIn size={12} />,      color: 'var(--tx3)' },
  system:      { label: 'System',      icon: <Settings size={12} />,   color: 'var(--tx4)' },
};

const ACTION_META = {
  create:           { label: 'Created',            icon: <FilePlus size={11} />,    color: 'var(--green)' },
  update:           { label: 'Updated',            icon: <Edit size={11} />,        color: 'var(--blue)' },
  delete:           { label: 'Deleted',            icon: <Trash2 size={11} />,      color: 'var(--red)' },
  approve:          { label: 'Approved',           icon: <CheckCircle size={11} />, color: 'var(--green)' },
  reject:           { label: 'Rejected',           icon: <XCircle size={11} />,     color: 'var(--red)' },
  submit:           { label: 'Submitted',          icon: <FilePlus size={11} />,    color: 'var(--blue)' },
  review:           { label: 'Marked in review',   icon: <Shield size={11} />,      color: 'var(--amber)' },
  document_upload:  { label: 'Document uploaded',  icon: <FilePlus size={11} />,    color: 'var(--coral)' },
  status_change:    { label: 'Status changed',     icon: <Edit size={11} />,        color: 'var(--amber)' },
  contract_created: { label: 'Contract created',   icon: <FileText size={11} />,    color: 'var(--green)' },
};

function useAuditLogs({ entityType, search, page, pageSize }) {
  return useQuery({
    queryKey: [...keys.auditLogs(), entityType, search, page],
    queryFn: async () => {
      let q = db.auditLogs()
        .select('*, performer:performed_by(full_name, email, avatar_initials)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (entityType && entityType !== 'all') q = q.eq('entity_type', entityType);

      const { data, error, count } = await q;
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    },
    keepPreviousData: true,
  });
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, padding: '2px 0' }}>
      <span style={{ color: 'var(--tx4)', minWidth: 80 }}>{label}</span>
      <span style={{ color: 'var(--tx2)', fontFamily: "'DM Mono', monospace", wordBreak: 'break-all' }}>
        {value != null ? String(value) : '—'}
      </span>
    </div>
  );
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const entityMeta = ENTITY_META[log.entity_type] || ENTITY_META.system;
  const actionMeta = ACTION_META[log.action] || { label: log.action, icon: <Edit size={11} />, color: 'var(--tx3)' };
  const details = log.details || {};
  const detailKeys = Object.keys(details);

  return (
    <div style={{ borderBottom: '1px solid var(--bdr)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 100px 120px 1fr 140px 28px',
          alignItems: 'center',
          padding: '10px 16px',
          cursor: detailKeys.length > 0 ? 'pointer' : 'default',
          gap: 8,
        }}
        onClick={() => detailKeys.length > 0 && setExpanded(p => !p)}
      >
        {/* Timestamp */}
        <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: "'DM Mono', monospace" }}>
          {new Date(log.created_at).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>

        {/* Entity type */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
          padding: '2px 8px', borderRadius: 999,
          background: entityMeta.color + '18', color: entityMeta.color,
          width: 'fit-content',
        }}>
          {entityMeta.icon} {entityMeta.label}
        </div>

        {/* Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: actionMeta.color }}>
          {actionMeta.icon}
          <span style={{ fontWeight: 500 }}>{actionMeta.label}</span>
        </div>

        {/* Description from details */}
        <div style={{ fontSize: 12, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {details.description || details.customer_name || details.company_name || details.reference || log.entity_id || '—'}
        </div>

        {/* Performer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {log.performer ? (
            <>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: 'var(--coral-l)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: 'var(--coral)', flexShrink: 0,
              }}>
                {log.performer.avatar_initials || log.performer.full_name?.[0] || '?'}
              </div>
              <span style={{ fontSize: 11, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.performer.full_name || log.performer.email}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--tx4)' }}>System</span>
          )}
        </div>

        {/* Expand toggle */}
        <div style={{ color: 'var(--tx4)', display: 'flex', justifyContent: 'center' }}>
          {detailKeys.length > 0 && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && detailKeys.length > 0 && (
        <div style={{
          background: 'var(--bg)', borderTop: '1px solid var(--bdr)',
          padding: '12px 16px 12px 48px',
        }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--tx4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Event details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
            {log.entity_id && <DetailRow label="Entity ID" value={log.entity_id} />}
            {detailKeys.map(k => (
              <DetailRow key={k} label={k.replace(/_/g, ' ')} value={
                typeof details[k] === 'object' ? JSON.stringify(details[k]) : details[k]
              } />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 30;
const ENTITY_OPTIONS = [
  { value: 'all',         label: 'All entities' },
  { value: 'deal',        label: 'Deals' },
  { value: 'contract',    label: 'Contracts' },
  { value: 'application', label: 'Applications' },
  { value: 'profile',     label: 'Profiles' },
  { value: 'prospect',    label: 'Prospects' },
  { value: 'quote',       label: 'Quotes' },
];

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useAuditLogs({ entityType, search, page, pageSize: PAGE_SIZE });
  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-sub">Full system activity trail — {total.toLocaleString()} events</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx4)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 30, fontSize: 12 }}
            placeholder="Search by entity ID or description…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select
          className="form-input"
          style={{ width: 160, fontSize: 12 }}
          value={entityType}
          onChange={e => { setEntityType(e.target.value); setPage(0); }}
        >
          {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '160px 100px 120px 1fr 140px 28px',
          gap: 8,
          padding: '8px 16px',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--bdr)',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--tx4)',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
        }}>
          <div>Timestamp</div>
          <div>Entity</div>
          <div>Action</div>
          <div>Description</div>
          <div>Performed by</div>
          <div />
        </div>

        {isLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size={24} />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--tx4)', fontSize: 13 }}>
            <Shield size={28} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
            No audit events found
          </div>
        ) : (
          logs.map(log => <LogRow key={log.id} log={log} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: 'var(--tx3)' }}>
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()} events
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11 }}
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11 }}
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
