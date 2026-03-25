import { useAppContext } from '../../context/AppContext';

export default function Confetti() {
  const { confettiItems } = useAppContext();
  return (
    <div className="conf-wrap">
      {confettiItems.map(item => (
        <div
          key={item.id}
          className="conf"
          style={{
            left: `${item.left}vw`,
            background: item.color,
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`,
            width: `${item.width}px`,
            height: `${item.height}px`,
            borderRadius: item.round ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}
