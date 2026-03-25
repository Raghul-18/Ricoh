import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, ShieldCheck, XCircle, CheckCircle,
  Search, RefreshCw, Mail, Lock, Power, Send, AlertTriangle,
} from 'lucide-react';
import { authClient, db, invokeAdminFunction } from '../../lib/backendClient';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';

// ── Hooks ──────────────────────────────────────────────────

function useAllUsers(roleFilter) {
  return useQuery({
    queryKey: ['admin', 'users', roleFilter],
    queryFn: async () => {
      let q = db.profiles()
        .select('*')
        .order('created_at', { ascending: false });
      if (roleFilter && roleFilter !== 'all') q = q.eq('role', roleFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }) => {
      const { error } = await db.profiles()
        .update({ onboarding_status: 'deactivated' })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }) => {
      const { error } = await db.profiles()
        .update({ onboarding_status: 'approved' })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, fullName }) => {
      await invokeAdminFunction('invite-admin', { email, fullName });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

function useRefreshPaymentStatuses() {
  return useMutation({
    mutationFn: async () => {
      await invokeAdminFunction('update-payment-statuses');
    },
  });
}

// ── Role + status badge helpers ────────────────────────────

const ROLE_META = {
  admin:      { label: 'Admin',      color: 'var(--coral)' },
  originator: { label: 'Originator', color: 'var(--blue)' },
  customer:   { label: 'Customer',   color: 'var(--green)' },
};

const STATUS_META = {
  approved:    { label: 'Active',      color: 'var(--green)' },
  pending:     { label: 'Pending',     color: 'var(--amber)' },
  submitted:   { label: 'Applied',     color: 'var(--blue)' },
  under_review:{ label: 'In review',   color: 'var(--amber)' },
  rejected:    { label: 'Rejected',    color: 'var(--red)' },
  deactivated: { label: 'Deactivated', color: 'var(--tx4)' },
};

function Badge({ text, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: color + '18', color,
    }}>
      {text}
    </span>
  );
}

// ── Invite Admin modal ─────────────────────────────────────

function InviteAdminModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const invite = useInviteAdmin();
  const { showToast } = useAppContext();

  const handleSubmit = async () => {
    if (!email || !name) return;
    try {
      await invite.mutateAsync({ email, fullName: name });
      showToast('Admin invitation sent — they will receive an email', 'success');
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card" style={{ width: 420, padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Invite new admin user</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--tx3)', display: 'block', marginBottom: 5 }}>Full name *</label>
          <input className="form-input" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--tx3)', display: 'block', marginBottom: 5 }}>Work email *</label>
          <input className="form-input" type="email" placeholder="jane@zorocapital.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="info-banner blue" style={{ marginBottom: 20 }}>
          <Mail size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />
          <div style={{ fontSize: 11 }}>They will receive an email invite and can set their own password. Requires the backend `invite-admin` endpoint to be available.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!email || !name || invite.isPending}>
            {invite.isPending ? <LoadingSpinner size={13} /> : <><Send size={13} /> Send invite</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User row ───────────────────────────────────────────────

function UserRow({ user, onPasswordReset }) {
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const { showToast } = useAppContext();
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const roleMeta = ROLE_META[user.role] || { label: user.role, color: 'var(--tx3)' };
  const statusMeta = STATUS_META[user.onboarding_status] || STATUS_META.pending;
  const isDeactivated = user.onboarding_status === 'deactivated';
  const isAdmin = user.role === 'admin';

  const handleDeactivate = async () => {
    try {
      await deactivate.mutateAsync({ userId: user.id });
      showToast('Account deactivated', 'success');
      setConfirmDeactivate(false);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleReactivate = async () => {
    try {
      await reactivate.mutateAsync({ userId: user.id });
      showToast('Account reactivated', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '40px 1fr 100px 110px 130px 110px',
      alignItems: 'center',
      padding: '10px 16px',
      borderBottom: '1px solid var(--bdr)',
      gap: 8,
      opacity: isDeactivated ? 0.6 : 1,
    }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: isDeactivated ? 'var(--bg)' : roleMeta.color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: roleMeta.color,
        border: `1px solid ${roleMeta.color}33`,
      }}>
        {user.avatar_initials || user.full_name?.[0] || '?'}
      </div>

      {/* Name + email */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{user.full_name || '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--tx4)' }}>{user.email}</div>
        {user.company_name && (
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{user.company_name}</div>
        )}
      </div>

      {/* Role */}
      <Badge text={roleMeta.label} color={roleMeta.color} />

      {/* Status */}
      <Badge text={statusMeta.label} color={statusMeta.color} />

      {/* Joined */}
      <div style={{ fontSize: 11, color: 'var(--tx4)' }}>
        {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 10, padding: '3px 8px', height: 26 }}
          title="Send password reset email"
          onClick={() => onPasswordReset(user.email)}
        >
          <Lock size={11} />
        </button>
        {!isAdmin && (
          isDeactivated ? (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 10, padding: '3px 8px', height: 26, color: 'var(--green)' }}
              title="Reactivate account"
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
                {deactivate.isPending ? <LoadingSpinner size={10} /> : 'Confirm'}
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '3px 8px', height: 26 }}
                onClick={() => setConfirmDeactivate(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 10, padding: '3px 8px', height: 26, color: 'var(--red)' }}
              title="Deactivate account"
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

// ── Main page ──────────────────────────────────────────────

export default function AdminUserManagement() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { data: users = [], isLoading } = useAllUsers(roleFilter);
  const sendReset = useSendPasswordReset();
  const refreshPayments = useRefreshPaymentStatuses();
  const { showToast } = useAppContext();

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.company_name?.toLowerCase().includes(q)
    );
  });

  const counts = {
    all:        users.length,
    admin:      users.filter(u => u.role === 'admin').length,
    originator: users.filter(u => u.role === 'originator').length,
    customer:   users.filter(u => u.role === 'customer').length,
  };

  const handlePasswordReset = async (email) => {
    try {
      await sendReset.mutateAsync({ email });
      showToast(`Password reset email sent to ${email}`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleRefreshPayments = async () => {
    try {
      const result = await refreshPayments.mutateAsync();
      showToast('Payment statuses refreshed', 'success');
    } catch (err) {
      showToast('Backend payment refresh endpoint is unavailable', 'warning');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">User management</div>
          <div className="page-sub">{users.length} total users across all roles</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={handleRefreshPayments}
            disabled={refreshPayments.isPending}
            title="Manually trigger payment status recalculation"
          >
            {refreshPayments.isPending ? <LoadingSpinner size={13} /> : <RefreshCw size={13} />}
            Refresh payment statuses
          </button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setShowInviteModal(true)}>
            <UserPlus size={13} /> Invite admin
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="kpi-row" style={{ gap: 10, marginBottom: 20 }}>
        {[
          { key: 'all',        label: 'Total users',   color: 'var(--tx)' },
          { key: 'admin',      label: 'Admins',        color: 'var(--coral)' },
          { key: 'originator', label: 'Originators',   color: 'var(--blue)' },
          { key: 'customer',   label: 'Customers',     color: 'var(--green)' },
        ].map(({ key, label, color }) => (
          <div
            key={key}
            className="metric-card"
            style={{ cursor: 'pointer', outline: roleFilter === key ? `2px solid ${color}` : undefined }}
            onClick={() => setRoleFilter(roleFilter === key && key !== 'all' ? 'all' : key)}
          >
            <div className="metric-value" style={{ color }}>{counts[key]}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx4)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 30, fontSize: 12 }}
            placeholder="Search name, email, or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'admin', 'originator', 'customer'].map(r => (
            <button
              key={r}
              className={`btn ${roleFilter === r ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, height: 32, padding: '0 12px' }}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'all' ? 'All roles' : r.charAt(0).toUpperCase() + r.slice(1) + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card table-scroll" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
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
        }}>
          <div />
          <div>User</div>
          <div>Role</div>
          <div>Status</div>
          <div>Joined</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--tx4)', fontSize: 13 }}>
            <Users size={28} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
            No users found
          </div>
        ) : (
          filtered.map(u => (
            <UserRow key={u.id} user={u} onPasswordReset={handlePasswordReset} />
          ))
        )}
      </div>

      {/* Backend endpoint notice */}
      <div className="info-banner blue" style={{ marginTop: 16 }}>
        <AlertTriangle size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />
        <div style={{ fontSize: 11 }}>
          <strong>Invite admin</strong> and <strong>Refresh payment statuses</strong> require backend admin endpoints to be configured.
        </div>
      </div>

      {showInviteModal && <InviteAdminModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
