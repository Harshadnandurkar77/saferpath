import { useEffect, useRef, useState } from "react";

export function IsometricRouteCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let progress = 0;

    // Set high-DPI resolution
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Isometric projection helpers
    // x: right-down, y: left-down, z: up
    const project = (x: number, y: number, z: number, originX: number, originY: number) => {
      const isoX = (x - y) * Math.cos(Math.PI / 6);
      const isoY = (x + y) * Math.sin(Math.PI / 6) - z;
      return { x: originX + isoX, y: originY + isoY };
    };

    // Route path definition in isometric grid coordinates
    const routeNodes = [
      { x: -140, y: 120, z: 0, label: "Origin" },
      { x: -70, y: 110, z: 0, label: "Hill Road North" },
      { x: -20, y: 50, z: 0, label: "Commercial Frontage" },
      { x: 40, y: 30, z: 0, label: "Illuminated Crossing" },
      { x: 90, y: -40, z: 0, label: "Transit Gate" },
      { x: 150, y: -70, z: 0, label: "Destination" },
    ];

    const contextBadges = [
      { x: -50, y: 80, z: 28, text: "Continuous Lighting", tone: "#16756c", bg: "#dcefe9" },
      { x: 10, y: 40, z: 34, text: "Active Evening Footpath", tone: "#16756c", bg: "#dcefe9" },
      { x: 110, y: -50, z: 30, text: "Verified Help Facility", tone: "#0369a1", bg: "#e0f2fe" },
    ];

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const ox = w / 2;
      const oy = h / 2 + 10;

      ctx.clearRect(0, 0, w, h);

      // Draw isometric grid base / ground plane
      ctx.save();
      const gridSize = 5;
      const step = 60;
      ctx.strokeStyle = "#e3e7e2";
      ctx.lineWidth = 1;

      for (let i = -gridSize; i <= gridSize; i++) {
        const p1 = project(i * step, -gridSize * step, 0, ox, oy);
        const p2 = project(i * step, gridSize * step, 0, ox, oy);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const p3 = project(-gridSize * step, i * step, 0, ox, oy);
        const p4 = project(gridSize * step, i * step, 0, ox, oy);
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
      }

      // Draw buildings / blocks in isometric projection
      const buildings = [
        { x: -100, y: -30, w: 45, d: 40, h: 45 },
        { x: -40, y: -80, w: 50, d: 35, h: 60 },
        { x: 30, y: -100, w: 40, d: 50, h: 50 },
        { x: -110, y: 40, w: 35, d: 45, h: 35 },
        { x: 60, y: 70, w: 45, d: 40, h: 40 },
        { x: 110, y: 10, w: 40, d: 40, h: 55 },
      ];

      buildings.forEach((b) => {
        // Top face
        const t1 = project(b.x, b.y, b.h, ox, oy);
        const t2 = project(b.x + b.w, b.y, b.h, ox, oy);
        const t3 = project(b.x + b.w, b.y + b.d, b.h, ox, oy);
        const t4 = project(b.x, b.y + b.d, b.h, ox, oy);

        // Base points
        const b2 = project(b.x + b.w, b.y, 0, ox, oy);
        const b3 = project(b.x + b.w, b.y + b.d, 0, ox, oy);
        const b4 = project(b.x, b.y + b.d, 0, ox, oy);

        // Right face
        ctx.fillStyle = "#e2e6e1";
        ctx.beginPath();
        ctx.moveTo(t2.x, t2.y);
        ctx.lineTo(b2.x, b2.y);
        ctx.lineTo(b3.x, b3.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.closePath();
        ctx.fill();

        // Left face
        ctx.fillStyle = "#d0d7cf";
        ctx.beginPath();
        ctx.moveTo(t4.x, t4.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.lineTo(b3.x, b3.y);
        ctx.lineTo(b4.x, b4.y);
        ctx.closePath();
        ctx.fill();

        // Top face
        ctx.fillStyle = "#edf1ec";
        ctx.beginPath();
        ctx.moveTo(t1.x, t1.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.lineTo(t4.x, t4.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#c5cecb";
        ctx.stroke();
      });

      // Draw Street corridor under route
      const projectedRoute = routeNodes.map((n) => project(n.x, n.y, 0, ox, oy));

      // Route glow / casing
      ctx.strokeStyle = "rgba(22, 117, 108, 0.18)";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      projectedRoute.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Main corridor line
      ctx.strokeStyle = "#16756c";
      ctx.lineWidth = 4;
      ctx.beginPath();
      projectedRoute.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Route nodes / light points
      projectedRoute.forEach((pt, idx) => {
        const isEndpoint = idx === 0 || idx === projectedRoute.length - 1;
        ctx.fillStyle = isEndpoint ? (idx === 0 ? "#16756c" : "#b6433d") : "#ffffff";
        ctx.strokeStyle = isEndpoint ? "#ffffff" : "#16756c";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isEndpoint ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Animated traveling pulse
      if (!reducedMotion) {
        progress = (progress + 0.0035) % 1;
      } else {
        progress = 0.5;
      }

      // Calculate position along polyline
      const totalSegments = projectedRoute.length - 1;
      const segProgress = progress * totalSegments;
      const currentSeg = Math.floor(segProgress);
      const frac = segProgress - currentSeg;

      if (currentSeg < totalSegments) {
        const pA = projectedRoute[currentSeg];
        const pB = projectedRoute[currentSeg + 1];
        const curX = pA.x + (pB.x - pA.x) * frac;
        const curY = pA.y + (pB.y - pA.y) * frac;

        // Pulse ring
        ctx.strokeStyle = "rgba(2, 132, 199, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(curX, curY, 12, 0, Math.PI * 2);
        ctx.stroke();

        // Traveler dot
        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.arc(curX, curY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Context floating badges with connecting stems
      contextBadges.forEach((badge) => {
        const base = project(badge.x, badge.y, 0, ox, oy);
        const top = project(badge.x, badge.y, badge.z, ox, oy);

        // Vertical stem line
        ctx.strokeStyle = "#8b9c94";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small base circle
        ctx.fillStyle = badge.tone;
        ctx.beginPath();
        ctx.arc(base.x, base.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Badge pill
        ctx.font = "600 11px system-ui, -apple-system, sans-serif";
        const textWidth = ctx.measureText(badge.text).width;
        const pillW = textWidth + 18;
        const pillH = 22;
        const px = top.x - pillW / 2;
        const py = top.y - pillH / 2;

        // Pill shadow
        ctx.shadowColor = "rgba(0,0,0,0.08)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        // Pill background
        ctx.fillStyle = badge.bg;
        ctx.beginPath();
        ctx.roundRect(px, py, pillW, pillH, 11);
        ctx.fill();

        // Pill border
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = badge.tone;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Pill text
        ctx.fillStyle = badge.tone;
        ctx.textBaseline = "middle";
        ctx.fillText(badge.text, px + 9, top.y + 0.5);
      });

      ctx.restore();

      if (!reducedMotion) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [reducedMotion]);

  return (
    <div className="relative h-full min-h-[380px] w-full overflow-hidden rounded-2xl border border-[#d8ddd7] bg-[#f7f6f1] p-2 shadow-sm sm:min-h-[440px] lg:min-h-[500px]">
      <canvas ref={canvasRef} className="h-full w-full block" aria-label="3D Isometric City Route Visualization" />
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-[#bdc9c0] bg-white/90 px-3 py-1.5 text-xs text-[#53615a] backdrop-blur-xs">
        <span className="font-semibold text-[#14231d]">Corridor visualization</span> · Multi-node illumination & context
      </div>
    </div>
  );
}

