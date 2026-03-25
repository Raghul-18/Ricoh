import { CreditCard, Briefcase, FileText, FileCheck, Star, Bell, CheckCheck, Info } from 'lucide-react';
import { useNotifications, useMarkAllRead, useMarkNotificationRead } from '../../hooks/useNotifications';
import { LoadingSpinner } from '../../components/shared/FormField';

const TYPE_META = {
  payment:    { icon: <CreditCard size={16} />,  color: 'var(--green)',  bg: 'var(--green-l)' },
  deal:       { icon: <Briefcase size={16} />,   color: 'var(--blue)',   bg: 'var(--blue-l)' },
  quote:      { icon: <FileText size={16} />,    color: 'var(--amber)',  bg: 'var(--amber-l)' },
  contract:   { icon: <FileCheck size={16} />,   color: 'var(--coral)',  bg: 'var(--coral-l)' },
  onboarding: { icon: <Star size={16} />,        color: '#7C3AED',      bg: '#F0EAFF' },
  system:     { icon: <Bell size={16} />,        color: 'var(--tx3)',   bg: 'var(--bg)' },
};

export default function P17Notifications() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkNotificationRead();

  const unread = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => markAll.mutateAsync();
  const handleRead = (id) => markOne.mutateAsync(id);

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Notifications</div>
          <div className="page-sub">{unread > 0 ? `${unread} unread` : 'All caught up'}</div>
        </div>
        {unread > 0 && (
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleMarkAllRead} disabled={markAll.isPending}>
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><Bell size={40} /></div>
            <div className="empty-state-title">No notifications</div>
            <div className="empty-state-sub">You're all caught up — notifications will appear here.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map(n => {
            const meta = TYPE_META[n.type] || TYPE_META.system;
            return (
              <div key={n.id} style={{
                background: n.read ? 'var(--surface)' : 'var(--surface)',
                border: `1px solid ${n.read ? 'var(--bdr)' : 'var(--coral-m)'}`,
                borderRadius: 'var(--rl)', padding: '14px 16px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                cursor: n.read ? 'default' : 'pointer',
                opacity: n.read ? .75 : 1,
              }} onClick={() => !n.read && handleRead(n.id)}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, flexShrink: 0 }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 13, marginBottom: 3 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: 'var(--tx3)', lineHeight: 1.5 }}>{n.body}</div>}
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 6 }}>
                    {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)', flexShrink: 0, marginTop: 5 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
