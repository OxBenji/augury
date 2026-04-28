"use client";

import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 60;
const SPEED = 0.3;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export function Murmuration() {
  const svgRef = useRef<SVGSVGElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Respect prefers-reduced-motion
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    const w = svg.clientWidth;
    const h = svg.clientHeight;
    const cx = w / 2;
    const cy = h / 2;

    // Initialize particles
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      size: 1.5 + Math.random() * 2,
    }));

    function animate() {
      const particles = particlesRef.current;
      particles.forEach((p) => {
        // Gentle pull toward center (converging flock)
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = 0.0002;

        p.vx += dx * pull;
        p.vy += dy * pull;

        // Dampen
        p.vx *= 0.998;
        p.vy *= 0.998;

        p.x += p.vx;
        p.y += p.vy;

        // Soft wrap
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      });

      // Update SVG circles
      const circles = svg!.querySelectorAll("circle");
      circles.forEach((circle, i) => {
        if (particles[i]) {
          circle.setAttribute("cx", String(particles[i].x));
          circle.setAttribute("cy", String(particles[i].y));
        }
      });

      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <circle
          key={i}
          cx={0}
          cy={0}
          r={1.5 + Math.random() * 2}
          fill="var(--ash)"
          opacity={0.15 + Math.random() * 0.2}
        />
      ))}
    </svg>
  );
}
