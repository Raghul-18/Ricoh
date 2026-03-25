// Zoro Capital brand mark — a geometric "Z" on coral

export function ZoroMark({ size = 32, radius = 8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect width="32" height="32" rx={radius} fill="#BF4528" />
      {/* Z letterform — top bar, diagonal, bottom bar */}
      <path
        d="M9 10h14M9 22h14L9 10"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ZoroMarkSmall({ size = 22 }) {
  return <ZoroMark size={size} radius={6} />;
}

export function ZoroWordmark({ size = 32, gap = 10, fontSize = 15 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      <ZoroMark size={size} />
      <span style={{ fontWeight: 700, fontSize, letterSpacing: '-.3px', color: 'var(--tx)' }}>
        Zoro Capital
      </span>
    </div>
  );
}
