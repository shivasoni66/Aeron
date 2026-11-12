import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DroneHero3D } from './DroneHero3D';

interface DroneHeroVisualProps {
  className?: string;
  imageSrc?: string;
  force2D?: boolean;
}

interface RotorConfig {
  id: string;
  name: string;
  xPct: number;
  yPct: number;
  rxPct: number;
  ryPct: number;
  tiltRad: number;
  speed: number;
  dir: number;
  hubRPct: number;
}

// Calibrated sub-pixel perspective geometry for 2200x1690 cleaned master asset
const ROTORS: RotorConfig[] = [
  {
    id: 'BL',
    name: 'Front-Left Rotor',
    xPct: 0.1174,
    yPct: 0.6024,
    rxPct: 0.145,
    ryPct: 0.088,
    tiltRad: -24.5 * (Math.PI / 180),
    speed: 18.5,
    dir: 1, // CW
    hubRPct: 0.012
  },
  {
    id: 'TL',
    name: 'Rear-Left Rotor',
    xPct: 0.3273,
    yPct: 0.3157,
    rxPct: 0.138,
    ryPct: 0.084,
    tiltRad: -24.5 * (Math.PI / 180),
    speed: 20.0,
    dir: -1, // CCW
    hubRPct: 0.011
  },
  {
    id: 'TR',
    name: 'Rear-Right Rotor',
    xPct: 0.7684,
    yPct: 0.1632,
    rxPct: 0.140,
    ryPct: 0.085,
    tiltRad: -23.5 * (Math.PI / 180),
    speed: 19.2,
    dir: 1, // CW
    hubRPct: 0.011
  },
  {
    id: 'BR',
    name: 'Front-Right Rotor',
    xPct: 0.7046,
    yPct: 0.5079,
    rxPct: 0.148,
    ryPct: 0.090,
    tiltRad: -20.0 * (Math.PI / 180),
    speed: 20.5,
    dir: -1, // CCW
    hubRPct: 0.012
  }
];

export const DroneHeroVisual: React.FC<DroneHeroVisualProps> = ({
  className = '',
  imageSrc = '/drone_hero_ultra.png',
  force2D = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [use3D, setUse3D] = useState(!force2D);

  const drawProps = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, angles: number[]) => {
      ctx.clearRect(0, 0, w * dpr, h * dpr);

      ROTORS.forEach((rotor, idx) => {
        const cx = w * rotor.xPct;
        const cy = h * rotor.yPct;
        const rx = w * rotor.rxPct;
        const ry = h * rotor.ryPct;
        const hubR = Math.max(3, w * rotor.hubRPct);
        const currentAngle = angles[idx];

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(cx, cy);
        ctx.rotate(rotor.tiltRad);
        // Elliptical perspective projection
        ctx.scale(1, ry / rx);

        // 1. Outer blurred disc simulating continuous high-RPM rotation
        const discGrad = ctx.createRadialGradient(0, 0, hubR * 0.8, 0, 0, rx);
        discGrad.addColorStop(0, 'rgba(191, 244, 46, 0.04)');
        discGrad.addColorStop(0.35, 'rgba(230, 245, 235, 0.09)');
        discGrad.addColorStop(0.72, 'rgba(191, 244, 46, 0.08)');
        discGrad.addColorStop(0.92, 'rgba(210, 235, 220, 0.14)');
        discGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fillStyle = discGrad;
        ctx.fill();

        // 2. High-speed propeller blade motion blur passes
        const bladeCount = 3;
        for (let b = 0; b < bladeCount; b++) {
          const bladeBaseAngle = currentAngle + (b * (Math.PI * 2)) / bladeCount;

          // Multi-layer motion blur sweep
          const ghostLayers = 8;
          for (let g = 0; g < ghostLayers; g++) {
            const sweepOffset = (g / ghostLayers) * 0.55 * rotor.dir;
            const a = bladeBaseAngle - sweepOffset;
            const alpha = (1 - g / ghostLayers) * 0.22;

            ctx.save();
            ctx.rotate(a);

            ctx.beginPath();
            ctx.moveTo(0, -hubR * 0.5);
            ctx.lineTo(rx * 0.45, -rx * 0.045);
            ctx.lineTo(rx * 0.98, -rx * 0.02);
            ctx.arc(rx, 0, rx * 0.025, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(rx * 0.45, rx * 0.045);
            ctx.lineTo(0, hubR * 0.5);
            ctx.closePath();

            ctx.fillStyle = `rgba(235, 245, 240, ${alpha})`;
            ctx.fill();

            // Subtle electric-lime tip highlight
            if (g === 0) {
              ctx.beginPath();
              ctx.arc(rx * 0.94, 0, rx * 0.03, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(191, 244, 46, 0.55)';
              ctx.fill();
            }

            ctx.restore();
          }
        }

        // 3. Central motor cap & precision bearing ring
        ctx.beginPath();
        ctx.arc(0, 0, hubR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(11, 16, 20, 0.96)';
        ctx.fill();
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.50)';
        ctx.stroke();

        ctx.restore();
      });
    },
    []
  );

  useEffect(() => {
    if (use3D) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let isRunning = true;
    let lastTime = 0;
    const angles = [0, 0.9, 1.8, 2.7];

    const syncCanvasSize = () => {
      const rect = img.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        if (prefersReducedMotion) {
          drawProps(ctx, rect.width, rect.height, dpr, [0, 0.5, 1.0, 1.5]);
        }
      }
    };

    syncCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
    });
    resizeObserver.observe(img);

    if (prefersReducedMotion) {
      return () => {
        resizeObserver.disconnect();
      };
    }

    const loop = (timestamp: number) => {
      if (!isRunning) return;

      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;

      const rect = img.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      if (w > 0 && h > 0) {
        ROTORS.forEach((rotor, idx) => {
          angles[idx] += rotor.speed * rotor.dir * dt * 2.8;
        });

        drawProps(ctx, w, h, dpr, angles);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    // Pause animation when tab is hidden to conserve GPU/CPU
    const handleVisibility = () => {
      if (document.hidden) {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      } else {
        lastTime = 0;
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver.disconnect();
    };
  }, [drawProps, imageLoaded, use3D]);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ perspective: 1200 }}
    >
      {/* Background Concentric Radar Orbit Rings (Layered Behind Aircraft) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
        {/* Outer Orbit Path - Clamped to prevent viewport edge clipping */}
        <div className="w-[460px] h-[460px] sm:w-[540px] sm:h-[540px] xl:w-[640px] xl:h-[640px] rounded-full border border-neutral-700/20 absolute" />

        {/* Middle Slow-Spinning Dashed Orbit Path with subtle green waypoint markers */}
        <div className="w-[350px] h-[350px] sm:w-[430px] sm:h-[430px] xl:w-[500px] xl:h-[500px] rounded-full border border-dashed border-[#BFF42E]/15 absolute animate-[spin_180s_linear_infinite]">
          {/* Orbit Waypoint Dots */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#BFF42E]/60 shadow-[0_0_8px_rgba(191,244,46,0.7)]" />
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#35C6D8]/50" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#BFF42E]/50" />
        </div>

        {/* Inner Tracking Circle */}
        <div className="w-[250px] h-[250px] sm:w-[310px] sm:h-[310px] xl:w-[360px] xl:h-[360px] rounded-full border border-neutral-600/25 absolute" />

        {/* Fine Cardinal Crosshair Ticks */}
        <svg
          className="w-[380px] h-[380px] sm:w-[460px] sm:h-[460px] xl:w-[540px] xl:h-[540px] absolute opacity-25 pointer-events-none"
          viewBox="0 0 500 500"
          fill="none"
        >
          <line x1="250" y1="20" x2="250" y2="40" stroke="#BFF42E" strokeWidth="1" />
          <line x1="250" y1="460" x2="250" y2="480" stroke="#BFF42E" strokeWidth="1" />
          <line x1="20" y1="250" x2="40" y2="250" stroke="#BFF42E" strokeWidth="1" />
          <line x1="460" y1="250" x2="480" y2="250" stroke="#BFF42E" strokeWidth="1" />
          <circle cx="250" cy="250" r="2" fill="#BFF42E" />
        </svg>

        {/* Soft Ambient Green Glow Underneath Aircraft */}
        <div
          className="absolute w-[360px] h-[260px] xl:w-[460px] xl:h-[320px] rounded-full blur-[100px] opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(191,244,46,0.20) 0%, transparent 70%)' }}
        />
      </div>

      {/* Soft Ground Shadow Underneath Aircraft */}
      <div className="absolute bottom-2 sm:bottom-6 w-52 sm:w-[360px] xl:w-[460px] h-10 bg-black/80 rounded-[100%] blur-2xl pointer-events-none" />

      {/* Floating Aircraft Stage Container */}
      <div
        className="relative z-10 transition-transform duration-700 w-[300px] sm:w-[400px] md:w-[460px] lg:w-[480px] xl:w-[530px] 2xl:w-[660px] aspect-[16/11] max-w-[680px] flex items-center justify-center"
        ref={containerRef}
      >
        {use3D ? (
          /* Genuine Three.js 3D WebGL Quadcopter */
          <div className="relative w-full h-full flex items-center justify-center">
            <DroneHero3D className="w-full h-full" onError={() => setUse3D(false)} />
          </div>
        ) : (
          /* Cleaned High-Resolution 2D Master Asset with 2D Live Propeller Canvas */
          <div
            className="relative inline-block"
            style={{
              animation: 'drone-hover 7s ease-in-out infinite'
            }}
          >
            <style>{`
              @keyframes drone-hover {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-6px) rotate(0.35deg); }
              }
            `}</style>
            <img
              ref={imageRef}
              src={imageSrc}
              alt="AERON Industrial Tactical Aircraft"
              className="w-full h-auto object-contain filter drop-shadow-[0_25px_50px_rgba(0,0,0,0.95)] transition-transform duration-700 block"
              draggable={false}
              onLoad={() => setImageLoaded(true)}
            />

            <canvas
              ref={canvasRef}
              id="prop-canvas"
              className="absolute inset-0 pointer-events-none w-full h-full"
              aria-label="Interactive Live Drone Propellers Canvas"
            />
          </div>
        )}
      </div>
    </div>
  );
};
