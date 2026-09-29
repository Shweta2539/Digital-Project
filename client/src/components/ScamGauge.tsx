import { useEffect, useRef } from 'react';

interface ScamGaugeProps {
  score: number;
  size?: number;
  showLabel?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#ff3b5c';
  if (score >= 70) return '#ff6b35';
  if (score >= 40) return '#f59e0b';
  return '#10b981';
}

function getScoreLabel(score: number): { level: string; description: string } {
  if (score >= 90) return { level: 'CRITICAL SCAM', description: 'Confirmed Fraud Activity' };
  if (score >= 70) return { level: 'HIGH RISK', description: 'Significant Red Flags Detected' };
  if (score >= 40) return { level: 'SUSPICIOUS', description: 'Inconsistencies Found' };
  return { level: 'LOW RISK', description: 'Appears Legitimate' };
}

export default function ScamGauge({ score, size = 200, showLabel = true }: ScamGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const currentScoreRef = useRef(0);

  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const strokeWidth = size * 0.08;

    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalAngle = endAngle - startAngle;

    function draw(displayScore: number) {
      ctx!.clearRect(0, 0, size, size);

      // Outer glow ring
      if (displayScore > 0) {
        const glowGradient = ctx!.createRadialGradient(cx, cy, radius - strokeWidth, cx, cy, radius + strokeWidth * 2);
        const glowColor = color;
        glowGradient.addColorStop(0, `${glowColor}00`);
        glowGradient.addColorStop(0.5, `${glowColor}20`);
        glowGradient.addColorStop(1, `${glowColor}00`);
        ctx!.beginPath();
        ctx!.arc(cx, cy, radius + strokeWidth * 0.5, 0, Math.PI * 2);
        ctx!.strokeStyle = glowGradient;
        ctx!.lineWidth = strokeWidth * 3;
        ctx!.stroke();
      }

      // Background track
      ctx!.beginPath();
      ctx!.arc(cx, cy, radius, startAngle, endAngle);
      ctx!.strokeStyle = 'rgba(99, 139, 255, 0.1)';
      ctx!.lineWidth = strokeWidth;
      ctx!.lineCap = 'round';
      ctx!.stroke();

      // Multi-color gradient arc
      if (displayScore > 0) {
        const gradient = ctx!.createConicalGradient
          ? null
          : ctx!.createLinearGradient(0, 0, size, 0);

        const scoreAngle = startAngle + (displayScore / 100) * totalAngle;

        // Draw colored arc
        ctx!.beginPath();
        ctx!.arc(cx, cy, radius, startAngle, scoreAngle);
        ctx!.strokeStyle = color;
        ctx!.lineWidth = strokeWidth;
        ctx!.lineCap = 'round';
        ctx!.shadowColor = color;
        ctx!.shadowBlur = 12;
        ctx!.stroke();
        ctx!.shadowBlur = 0;
      }

      // Center display
      ctx!.fillStyle = 'rgba(5, 8, 20, 0.0)';
      ctx!.beginPath();
      ctx!.arc(cx, cy, radius - strokeWidth * 0.7, 0, Math.PI * 2);
      ctx!.fill();

      // Score number
      ctx!.fillStyle = color;
      ctx!.font = `bold ${size * 0.2}px 'Space Grotesk', sans-serif`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(`${Math.round(displayScore)}`, cx, cy - size * 0.04);

      // Percentage label
      ctx!.fillStyle = 'rgba(136, 153, 204, 0.8)';
      ctx!.font = `${size * 0.075}px 'Inter', sans-serif`;
      ctx!.fillText('THREAT SCORE', cx, cy + size * 0.1);

      // Tick marks
      const tickCount = 10;
      for (let i = 0; i <= tickCount; i++) {
        const tickAngle = startAngle + (i / tickCount) * totalAngle;
        const tickRadius = radius + strokeWidth * 0.9;
        const tickInnerRadius = radius + strokeWidth * 1.4;
        const x1 = cx + Math.cos(tickAngle) * tickRadius;
        const y1 = cy + Math.sin(tickAngle) * tickRadius;
        const x2 = cx + Math.cos(tickAngle) * tickInnerRadius;
        const y2 = cy + Math.sin(tickAngle) * tickInnerRadius;
        ctx!.beginPath();
        ctx!.moveTo(x1, y1);
        ctx!.lineTo(x2, y2);
        ctx!.strokeStyle = i * 10 <= displayScore ? color : 'rgba(99,139,255,0.2)';
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }
    }

    // Animate score from 0 to target
    const duration = 1200;
    const startTime = performance.now();
    const fromScore = currentScoreRef.current;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const displayScore = fromScore + (score - fromScore) * eased;
      draw(displayScore);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        currentScoreRef.current = score;
        draw(score);
      }
    }

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [score, size, color]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} className="block" />
      </div>
      {showLabel && (
        <div className="text-center space-y-1">
          <div
            className={`inline-flex px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest ${
              score >= 90
                ? 'badge-critical'
                : score >= 70
                ? 'badge-high'
                : score >= 40
                ? 'badge-suspicious'
                : 'badge-safe'
            }`}
          >
            {label.level}
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {label.description}
          </p>
        </div>
      )}
    </div>
  );
}
