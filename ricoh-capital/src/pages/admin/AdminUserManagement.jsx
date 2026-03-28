import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, XCircle, Search, RefreshCw, Mail, Lock, Power, Send, AlertTriangle,
} from 'lucide-react';
import { authClient, db, invokeAdminFunction } from '../../lib/backendClient';
import { useAppContext } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';
import { LoadingSpinner } from '../../components/shared/FormField';

function getText(t, key, fallback, values) {
  const translated = t(key, values);
  return translated === key ? fallback : translated;
}

function useAllUsers(roleFilter) {
  return useQuery({
    queryKey: ['admin', 'users', roleFilter],
    queryFn: async () => {
      let query = db.profiles()
        .select('*')
        .order('created_at', { ascending: false });

      if (roleFilter && roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }) => {
      const { error } = await db.profiles()
        .update({ onboarding_status: 'deactivated' })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }) => {
      const { error } = await db.profiles()
        .update({ onboarding_status: 'approved' })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

function useSendPasswordReset() {
  return useMutation({
    mutationFn: async ({ email }) => {
      const { error } = await authClient.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
    },
  });
}

function useInviteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, fullName }) => {
      await invokeAdminFunction('invite-admin', { email, fullName });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

function useRefreshPaymentStatuses() {
  return useMutation({
    mutationFn: async () => invokeAdminFunction('update-payment-statuses'),
  });
}

const ROLE_META = {
  admin: { color: 'var(--coral)', labelKey: 'admin.usersRoleAdmin', fallback: 'Admin' },
  originator: { color: 'var(--blue)', labelKey: 'admin.usersRoleOriginator', fallback: 'Originator' },
  customer: { color: 'var(--green)', labelKey: 'admin.usersRoleCustomer', fallback: 'Customer' },
};

const STATUS_META = {
  approved: { color: 'var(--green)', labelKey: 'admin.usersStatusActive', fallback: 'Active' },
  pending: { color: 'var(--amber)', labelKey: 'admin.usersStatusPending', fallback: 'Pending' },
  submitted: { color: 'var(--blue)', labelKey: 'admin.usersStatusApplied', fallback: 'Applied' },
  under_review: { color: 'var(--amber)', labelKey: 'common.inReview', fallback: 'In review' },
  rejected: { color: 'var(--red)', labelKey: 'admin.usersStatusRejected', fallback: 'Rejected' },
  deactivated: { color: 'var(--tx4)', labelKey: 'admin.usersStatusDeactivated', fallback: 'Deactivated' },
};

function Badge({ text, color }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 99,
        background: `${color}18`,
        color,
      }}
    >
      {text}
    </span>
  );
}

function InviteAdminModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const invite = useInviteAdmin();
  const { showToast } = useAppContext();
  const { t } = useLocale();

  const handleSubmit = async () => {
    if (!email || !name) return;
    try {
      await invite.mutateAsync({ email, fullName: name });
      showToast(getText(t, 'admin.usersInviteSent', 'Admin invitation sent - they will receive an email'), 'success');
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div className="card" style={{ width: 420, padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
          {getText(t, 'admin.usersInviteTitle', 'Invite new admin user')}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--tx3)', display: 'block', marginBottom: 5 }}>
            {getText(t, 'admin.usersFullName', 'Full name')} *
          </label>
          <input
            className="form-input"
            placeholder="Jane Smith"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--tx3)', display: 'block', marginBottom: 5 }}>
            {getText(t, 'admin.usersWorkEmail', 'Work email')} *
          </label>
          <input
            className="form-input"
            type="email"
            placeholder="jane@ricohcapital.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="info-banner blue" style={{ marginBottom: 20 }}>
          <Mail size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />
          <div style={{ fontSize: 11 }}>
            {getText(
              t,
              'admin.usersInviteInfo',
              'They will receive an email invite and can set their own password. Requires the backend invite-admin endpoint to be available.',
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            {getText(t, 'admin.cancel', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!email || !name || invite.isPending}>
            {invite.isPending ? <LoadingSpinner size={13} /> : (
              <>
                <Send size={13} />
                {getText(t, 'admin.usersSendInvite', 'Send invite')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserRow({ user, onPasswordReset }) {
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const { showToast } = useAppContext();
  const { formatDate, t } = useLocale();
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const roleMeta = ROLE_META[user.role] || { labelKey: 'admin.usersRoleUnknown', fallback: user.role, color: 'var(--tx3)' };
  const statusMeta = STATUS_META[user.onboarding_status] || STATUS_META.pending;
  const isDeactivated = user.onboarding_status === 'deactivated';
  const isAdmin = user.role === 'admin';

  const handleDeactivate = async () => {
    try {
      await deactivate.mutateAsync({ userId: user.id });
      showToast(getText(t, 'admin.usersDeactivatedToast', 'Account deactivated'), 'success');
      setConfirmDeactivate(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivate.mutateAsync({ userId: user.id });
      showToast(getText(t, 'admin.usersReactivatedToast', 'Account reactivated'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 100px 110px 130px 110px',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: '1px solid var(--bdr)',
        gap: 8,
        opacity: isDeactivated ? 0.6 : 1,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: isDeactivated ? 'var(--bg)' : `${roleMeta.color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: roleMeta.color,
          border: `1px solid ${roleMeta.color}33`,
        }}
      >
        {user.avatar_initials || user.full_name?.[0] || '?'}
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{user.full_name || '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--tx4)' }}>{user.email}</div>
        {user.company_name && (
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{user.company_name}</div>
        )}
      </div>

      <Badge text={getText(t, roleMeta.labelKey, roleMeta.fallback)} color={roleMeta.color} />
      <Badge text={getText(t, statusMeta.labelKey, statusMeta.fallback)} color={statusMeta.color} />

      <div style={{ fontSize: 11, color: 'var(--tx4)' }}>
        {formatDate(user.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>

      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 10, padding: '3px 8px', height: 26 }}
          title={getText(t, 'admin.usersPasswordResetTitle', 'Send password reset email')}
          onClick={() => onPasswordReset(user.email)}
        >
          <Lock size={11} />
        </button>
        {!isAdmin && (
          isDeactivated ? (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 10, padding: '3px 8px', height: 26, color: 'var(--green)' }}
              title={getText(t, 'admin.usersReactivateTitle', 'Reactivate account')}
              onClick={handleReactivate}
              disabled={reactivate.isPending}
            >
              {reactivate.isPending ? <LoadingSpinner size={10} /> : <Power size={11} />}
            </button>
          ) : confirmDeactivate ? (
            <>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '3px 8px', height: 26, color: 'var(--red)', border: '1px solid var(--red-m)' }}
                onClick={handleDeactivate}
                disabled={deactivate.isPending}
              >
                {deactivate.isPending ? <LoadingSpinner size={10} /> : getText(t, 'admin.confirm', 'Confirm')}
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '3px 8px', height: 26 }}
                onClick={() => setConfirmDeactivate(false)}
              >
                {getText(t, 'admin.cancel', 'Cancel')}
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 10, padding: '3px 8px', height: 26, color: 'var(--red)' }}
              title={getText(t, 'admin.usersDeactivateTitle', 'Deactivate account')}
              onClick={() => setConfirmDeactivate(true)}
            >
              <XCircle size={11} />
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function AdminUserManagement() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { data: users = [], isLoading, error } = useAllUsers(roleFilter);
  const sendReset = useSendPasswordReset();
  const refreshPayments = useRefreshPaymentStatuses();
  const { showToast } = useAppContext();
  const { t, formatNumber } = useLocale();

  const filtered = users.filter((user) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query)
      || user.full_name?.toLowerCase().includes(query)
      || user.company_name?.toLowerCase().includes(query)
    );
  });

  const counts = {
    all: users.length,
    admin: users.filter((user) => user.role === 'admin').length,
    originator: users.filter((user) => user.role === 'originator').length,
    customer: users.filter((user) => user.role === 'customer').length,
  };

  const handlePasswordReset = async (email) => {
    try {
      await sendReset.mutateAsync({ email });
      showToast(getText(t, 'admin.usersPasswordResetToast', 'Password reset email sent to {email}', { email }), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRefreshPayments = async () => {
    try {
      await refreshPayments.mutateAsync();
      showToast(getText(t, 'admin.usersRefreshPaymentsToast', 'Payment statuses refreshed'), 'success');
    } catch (err) {
      showToast(getText(t, 'admin.usersRefreshPaymentsWarning', 'Backend payment refresh endpoint is unavailable'), 'warning');
    }
  };

  const statCards = [
    { key: 'all', label: getText(t, 'admin.usersTotalUsers', 'Total users'), color: 'var(--tx)' },
    { key: 'admin', label: getText(t, 'admin.usersAdmins', 'Admins'), color: 'var(--coral)' },
    { key: 'originator', label: getText(t, 'admin.usersOriginators', 'Originators'), color: 'var(--blue)' },
    { key: 'customer', label: getText(t, 'admin.usersCustomers', 'Customers'), color: 'var(--green)' },
  ];

  const roleButtons = [
    ['all', getText(t, 'admin.usersAllRoles', 'All roles')],
    ['admin', getText(t, 'admin.usersAdmins', 'Admins')],
    ['originator', getText(t, 'admin.usersOriginators', 'Originators')],
    ['customer', getText(t, 'admin.usersCustomers', 'Customers')],
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{getText(t, 'admin.usersPageTitle', 'User management')}</div>
          <div className="page-sub">
            {getText(t, 'admin.usersPageSub', '{count} total users across all roles', {
              count: formatNumber(users.length),
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={handleRefreshPayments}
            disabled={refreshPayments.isPending}
            title={getText(t, 'admin.usersRefreshPaymentsHint', 'Manually trigger payment status recalculation')}
          >
            {refreshPayments.isPending ? <LoadingSpinner size={13} /> : <RefreshCw size={13} />}
            {getText(t, 'admin.usersRefreshPayments', 'Refresh payment statuses')}
          </button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setShowInviteModal(true)}>
            <UserPlus size={13} />
            {getText(t, 'admin.usersInviteAdmin', 'Invite admin')}
          </button>
        </div>
      </div>

      <div className="kpi-row" style={{ gap: 10, marginBottom: 20 }}>
        {statCards.map(({ key, label, color }) => (
          <div
            key={key}
            className="metric-card"
            style={{ cursor: 'pointer', outline: roleFilter === key ? `2px solid ${color}` : undefined }}
            onClick={() => setRoleFilter(roleFilter === key && key !== 'all' ? 'all' : key)}
          >
            <div className="metric-value" style={{ color }}>{formatNumber(counts[key])}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
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
            placeholder={getText(t, 'admin.usersSearchPlaceholder', 'Search name, email, or company...')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {roleButtons.map(([role, label]) => (
            <button
              key={role}
              className={`btn ${roleFilter === role ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, height: 32, padding: '0 12px' }}
              onClick={() => setRoleFilter(role)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card table-scroll" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 100px 110px 130px 110px',
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
          <div />
          <div>{getText(t, 'common.user', 'User')}</div>
          <div>{getText(t, 'admin.usersRoleColumn', 'Role')}</div>
          <div>{getText(t, 'common.status', 'Status')}</div>
          <div>{getText(t, 'admin.usersJoined', 'Joined')}</div>
          <div style={{ textAlign: 'right' }}>{getText(t, 'admin.usersActions', 'Actions')}</div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size={24} />
          </div>
        ) : error ? (
          <div style={{ padding: '24px 16px', color: 'var(--red)', fontSize: 13 }}>
            {error.message}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--tx4)', fontSize: 13 }}>
            <Users size={28} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            {getText(t, 'admin.usersEmpty', 'No users found')}
          </div>
        ) : (
          filtered.map((user) => (
            <UserRow key={user.id} user={user} onPasswordReset={handlePasswordReset} />
          ))
        )}
      </div>

      <div className="info-banner blue" style={{ marginTop: 16 }}>
        <AlertTriangle size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />
        <div style={{ fontSize: 11 }}>
          {getText(
            t,
            'admin.usersBackendNotice',
            'Invite admin and refresh payment statuses require backend admin endpoints to be configured.',
          )}
        </div>
      </div>

      {showInviteModal && <InviteAdminModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
