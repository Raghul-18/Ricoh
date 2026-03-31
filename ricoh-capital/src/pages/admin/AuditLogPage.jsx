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
import { useLocale } from '../../context/LocaleContext';

const PAGE_SIZE = 30;
const LOG_GRID_TEMPLATE = '180px 120px 190px minmax(260px, 1fr) 180px 28px';
const ENTITY_OPTIONS = [
  { value: 'all', labelKey: 'common.all' },
  { value: 'deal', labelKey: 'admin.auditEntityDeals' },
  { value: 'contract', labelKey: 'admin.auditEntityContracts' },
  { value: 'application', labelKey: 'admin.auditEntityApplications' },
  { value: 'profile', labelKey: 'admin.auditEntityProfiles' },
  { value: 'prospect', labelKey: 'admin.auditEntityProspects' },
  { value: 'quote', labelKey: 'admin.auditEntityQuotes' },
];

function getText(t, key, fallback, values) {
  const translated = t(key, values);
  return translated === key ? fallback : translated;
}

function buildEntityMeta(t) {
  return {
    deal: { label: getText(t, 'admin.auditEntityDeal', 'Deal'), icon: <Briefcase size={12} />, color: 'var(--blue)' },
    contract: { label: getText(t, 'admin.auditEntityContract', 'Contract'), icon: <FileText size={12} />, color: 'var(--green)' },
    application: { label: getText(t, 'admin.auditEntityApplication', 'Application'), icon: <FilePlus size={12} />, color: 'var(--amber)' },
    profile: { label: getText(t, 'admin.auditEntityProfile', 'Profile'), icon: <User size={12} />, color: 'var(--coral)' },
    prospect: { label: getText(t, 'admin.auditEntityProspect', 'Prospect'), icon: <User size={12} />, color: 'var(--tx3)' },
    quote: { label: getText(t, 'admin.auditEntityQuote', 'Quote'), icon: <FileText size={12} />, color: 'var(--blue)' },
    auth: { label: getText(t, 'admin.auditEntityAuth', 'Auth'), icon: <LogIn size={12} />, color: 'var(--tx3)' },
    system: { label: getText(t, 'admin.auditEntitySystem', 'System'), icon: <Settings size={12} />, color: 'var(--tx4)' },
  };
}

function buildActionMeta(t) {
  return {
    create: { label: getText(t, 'admin.auditActionCreate', 'Created'), icon: <FilePlus size={11} />, color: 'var(--green)' },
    update: { label: getText(t, 'admin.auditActionUpdate', 'Updated'), icon: <Edit size={11} />, color: 'var(--blue)' },
    delete: { label: getText(t, 'admin.auditActionDelete', 'Deleted'), icon: <Trash2 size={11} />, color: 'var(--red)' },
    approve: { label: getText(t, 'admin.auditActionApprove', 'Approved'), icon: <CheckCircle size={11} />, color: 'var(--green)' },
    reject: { label: getText(t, 'admin.auditActionReject', 'Rejected'), icon: <XCircle size={11} />, color: 'var(--red)' },
    submit: { label: getText(t, 'admin.auditActionSubmit', 'Submitted'), icon: <FilePlus size={11} />, color: 'var(--blue)' },
    review: { label: getText(t, 'admin.auditActionReview', 'Marked in review'), icon: <Shield size={11} />, color: 'var(--amber)' },
    document_upload: { label: getText(t, 'admin.auditActionDocumentUpload', 'Document uploaded'), icon: <FilePlus size={11} />, color: 'var(--coral)' },
    status_change: { label: getText(t, 'admin.auditActionStatusChange', 'Status changed'), icon: <Edit size={11} />, color: 'var(--amber)' },
    contract_created: { label: getText(t, 'admin.auditActionContractCreated', 'Contract created'), icon: <FileText size={11} />, color: 'var(--green)' },
  };
}

function getAvatarInitials(performer) {
  if (!performer) return '?';
  const name = String(performer.full_name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?';
  }
  return String(performer.email || '?').trim()[0]?.toUpperCase() || '?';
}

function useAuditLogs({ entityType, search, page, pageSize }) {
  return useQuery({
    queryKey: [...keys.auditLogs(), entityType, search, page, pageSize],
    queryFn: async () => {
      let query = db.auditLogs()
        .select('*')
        .order('created_at', { ascending: false });

      if (entityType && entityType !== 'all') {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;
      if (error) throw error;

      const logs = data || [];
      const performerIds = [...new Set(logs.map((log) => log.performed_by).filter(Boolean))];
      let performersById = {};

      if (performerIds.length > 0) {
        const { data: performers, error: performerError } = await db.profiles()
          .select('id, full_name, email')
          .in('id', performerIds);

        if (performerError) throw performerError;

        performersById = Object.fromEntries((performers || []).map((performer) => [performer.id, performer]));
      }

      const hydrated = logs.map((log) => ({
        ...log,
        performer: log.performed_by ? performersById[log.performed_by] || null : null,
      }));

      const normalizedSearch = search.trim().toLowerCase();
      const filtered = normalizedSearch
        ? hydrated.filter((log) => {
          const details = log.details || {};
          const haystack = [
            log.entity_type,
            log.entity_id,
            log.action,
            details.description,
            details.customer_name,
            details.company_name,
            details.reference,
            log.performer?.full_name,
            log.performer?.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedSearch);
        })
        : hydrated;

      const total = filtered.length;
      const start = page * pageSize;
      const end = start + pageSize;

      return {
        logs: filtered.slice(start, end),
        total,
      };
    },
    keepPreviousData: true,
  });
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, padding: '2px 0' }}>
      <span style={{ color: 'var(--tx4)', minWidth: 96 }}>{label}</span>
      <span style={{ color: 'var(--tx2)', fontFamily: "'DM Mono', monospace", wordBreak: 'break-all' }}>
        {value != null && value !== '' ? String(value) : '—'}
      </span>
    </div>
  );
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const { formatDate, t } = useLocale();
  const entityMeta = buildEntityMeta(t)[log.entity_type] || buildEntityMeta(t).system;
  const actionMeta = buildActionMeta(t)[log.action] || {
    label: log.action,
    icon: <Edit size={11} />,
    color: 'var(--tx3)',
  };
  const details = log.details || {};
  const detailKeys = Object.keys(details);

  return (
    <div style={{ borderBottom: '1px solid var(--bdr)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: LOG_GRID_TEMPLATE,
          alignItems: 'center',
          padding: '10px 16px',
          cursor: detailKeys.length > 0 ? 'pointer' : 'default',
          gap: 8,
        }}
        onClick={() => detailKeys.length > 0 && setExpanded((prev) => !prev)}
      >
        <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: "'DM Mono', monospace" }}>
          {formatDate(log.created_at, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            background: `${entityMeta.color}18`,
            color: entityMeta.color,
            width: 'fit-content',
          }}
        >
          {entityMeta.icon}
          {entityMeta.label}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: actionMeta.color, minWidth: 0 }}>
          {actionMeta.icon}
          <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actionMeta.label}</span>
        </div>

        <div style={{ fontSize: 12, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {details.description || details.customer_name || details.company_name || details.reference || log.entity_id || '—'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {log.performer ? (
            <>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--coral-l)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--coral)',
                  flexShrink: 0,
                }}
              >
                {getAvatarInitials(log.performer)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.performer.full_name || log.performer.email}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--tx4)' }}>{getText(t, 'admin.auditSystemUser', 'System')}</span>
          )}
        </div>

        <div style={{ color: 'var(--tx4)', display: 'flex', justifyContent: 'center' }}>
          {detailKeys.length > 0 && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </div>
      </div>

      {expanded && detailKeys.length > 0 && (
        <div
          style={{
            background: 'var(--bg)',
            borderTop: '1px solid var(--bdr)',
            padding: '12px 16px 12px 48px',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 11,
              color: 'var(--tx4)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '.05em',
            }}
          >
            {getText(t, 'admin.auditEventDetails', 'Event details')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
            {log.entity_id && (
              <DetailRow label={getText(t, 'admin.auditEntityId', 'Entity ID')} value={log.entity_id} />
            )}
            {detailKeys.map((key) => (
              <DetailRow
                key={key}
                label={key.replace(/_/g, ' ')}
                value={typeof details[key] === 'object' ? JSON.stringify(details[key]) : details[key]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { t, formatNumber } = useLocale();

  const { data, isLoading, error } = useAuditLogs({
    entityType,
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{getText(t, 'admin.auditLogPageTitle', 'Audit log')}</div>
          <div className="page-sub">
            {getText(t, 'admin.auditLogPageSub', 'Full system activity trail — {count} events', {
              count: formatNumber(total),
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--tx4)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="form-input"
            style={{ paddingLeft: 30, fontSize: 12 }}
            placeholder={getText(t, 'admin.auditSearchPlaceholder', 'Search by entity ID or description...')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          className="form-input"
          style={{ width: 180, fontSize: 12 }}
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value);
            setPage(0);
          }}
        >
          {ENTITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {getText(t, option.labelKey, option.value)}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: LOG_GRID_TEMPLATE,
            gap: 8,
            padding: '8px 16px',
            background: 'var(--bg)',
            borderBottom: '1px solid var(--bdr)',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--tx4)',
            textTransform: 'uppercase',
            letterSpacing: '.05em',
          }}
        >
          <div>{getText(t, 'admin.auditTimestamp', 'Timestamp')}</div>
          <div>{getText(t, 'admin.auditEntityColumn', 'Entity')}</div>
          <div>{getText(t, 'admin.auditActionColumn', 'Action')}</div>
          <div>{getText(t, 'admin.auditDescriptionColumn', 'Description')}</div>
          <div>{getText(t, 'admin.auditPerformedBy', 'Performed by')}</div>
          <div />
        </div>

        {isLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size={24} />
          </div>
        ) : error ? (
          <div style={{ padding: '24px 16px', color: 'var(--red)', fontSize: 13 }}>
            {error.message}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--tx4)', fontSize: 13 }}>
            <Shield size={28} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            {getText(t, 'admin.auditEmpty', 'No audit events found')}
          </div>
        ) : (
          logs.map((log) => <LogRow key={log.id} log={log} />)
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: 'var(--tx3)' }}>
          <span>
            {getText(t, 'admin.auditShowing', 'Showing {from}–{to} of {total} events', {
              from: formatNumber(page * PAGE_SIZE + 1),
              to: formatNumber(Math.min((page + 1) * PAGE_SIZE, total)),
              total: formatNumber(total),
            })}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11 }}
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              {getText(t, 'admin.previous', 'Previous')}
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11 }}
              disabled={page >= totalPages - 1}
              onClick={() => setPage((current) => current + 1)}
            >
              {getText(t, 'admin.next', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
