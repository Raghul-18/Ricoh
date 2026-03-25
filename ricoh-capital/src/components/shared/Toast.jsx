import { useAppContext } from '../../context/AppContext';

const VARIANT_STYLES = {
  success: { background: 'var(--green)', color: '#fff' },
  error:   { background: 'var(--red)',   color: '#fff' },
  warning: { background: 'var(--amber)', color: '#fff' },
  info:    { background: 'var(--tx1)',   color: '#fff' },
};

const VARIANT_ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

export default function Toast() {
  const { toast } = useAppContext();
  const style = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info;
  const icon = VARIANT_ICONS[toast.variant] || '';

  return (
    <div className={`toast ${toast.visible ? 'on' : ''}`} style={style}>
      {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
      {toast.message}
    </div>
  );
}
