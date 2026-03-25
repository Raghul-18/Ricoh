// Ricoh Capital brand mark — a simple RC monogram on coral.

export function RicohMark({ size = 32, radius = 8 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: '#BF4528',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: Math.round(size * 0.42),
        letterSpacing: '-0.06em',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      RC
    </div>
  );
}

export function RicohMarkSmall({ size = 22 }) {
  return <RicohMark size={size} radius={6} />;
}

export function RicohWordmark({ size = 32, gap = 10, fontSize = 15 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      <RicohMark size={size} />
      <span style={{ fontWeight: 700, fontSize, letterSpacing: '-.3px', color: 'var(--tx)' }}>
        Ricoh Capital
      </span>
    </div>
  );
}
