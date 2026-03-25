export function FormField({ label, required, error, children, hint }) {
  return (
    <div className="form-field">
      {label && (
        <div className="field-label">
          {label} {required && <span className="req">*</span>}
        </div>
      )}
      {children}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
          {error}
        </div>
      )}
      {hint && !error && (
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function LoadingSpinner({ size = 16 }) {
  return (
    <div style={{
      width: size, height: size, border: `2px solid rgba(255,255,255,0.3)`,
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    }} />
  );
}
