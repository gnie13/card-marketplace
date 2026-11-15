"use client";

import { useEffect, useRef, useState } from "react";

type Api = { flip: () => void; toggleSpin: () => void };

/**
 * A card you can turn in 3D, built from one front and one back photo.
 * The two photos sit on either side of a thin stack of layers that stands in for the card's edge.
 * Drag turns it, a tap flips it, and it idles in a slow spin until someone touches it.
 */
export function Card3D({ front, back, name, slab = false, onError }: { front: string; back: string; name: string; slab?: boolean; onError?: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLImageElement>(null);
  const api = useRef<Api | null>(null);
  const [ratio, setRatio] = useState(5 / 7);
  const [spinning, setSpinning] = useState(false);

  // The card takes the shape of the front photo, within sane limits, so slabs and odd crops still look right.
  const fit = (img: HTMLImageElement) => {
    if (img.naturalWidth && img.naturalHeight) setRatio(Math.max(0.5, Math.min(0.85, img.naturalWidth / img.naturalHeight)));
  };

  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;
    if (frontRef.current?.complete) fit(frontRef.current);

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const REST_TILT = 4;
    let ry = -24; // degrees around the vertical axis
    let rx = REST_TILT; // slight tilt toward the viewer
    let vy = 0; // spin speed after a drag, degrees per second
    let auto = !calm;
    let dragging = false;
    let visible = true;
    let target: number | null = null;
    let raf = 0;
    let last = 0;
    let px = 0, py = 0, pt = 0, moved = 0, downAt = 0;

    const paint = () => {
      card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      const rad = (ry * Math.PI) / 180;
      stage.style.setProperty("--sq", Math.max(0.08, Math.abs(Math.cos(rad))).toFixed(3));
      stage.style.setProperty("--shine", `${(50 + Math.sin(rad) * 70).toFixed(1)}%`);
      stage.style.setProperty("--glow", Math.min(1, Math.abs(Math.sin(rad)) * 1.6).toFixed(3));
    };
    const moving = () => visible && !dragging && (auto || target !== null || Math.abs(vy) > 1 || Math.abs(rx - REST_TILT) > 0.1);
    const step = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!dragging) {
        if (target !== null) {
          ry += (target - ry) * Math.min(1, dt * 9);
          if (Math.abs(target - ry) < 0.4) {
            ry = target;
            target = null;
          }
        } else if (Math.abs(vy) > 1) {
          ry += vy * dt;
          vy *= Math.exp(-dt * 2.6);
        } else if (auto) {
          vy = 0;
          ry += 28 * dt;
        }
        rx += (REST_TILT - rx) * Math.min(1, dt * 5);
      }
      paint();
      if (moving()) raf = requestAnimationFrame(step);
    };
    const kick = () => {
      if (raf || !moving()) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    const setAuto = (on: boolean) => {
      auto = on;
      setSpinning(on);
    };
    const turnTo = (angle: number) => {
      setAuto(false);
      vy = 0;
      target = angle;
      if (calm) {
        ry = angle;
        target = null;
        paint();
      } else kick();
    };
    const flip = () => turnTo(Math.round(ry / 180) * 180 + 180);

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      setAuto(false);
      target = null;
      vy = 0;
      px = e.clientX;
      py = e.clientY;
      pt = downAt = e.timeStamp;
      moved = 0;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("grabbing");
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      const dt = Math.max(1, e.timeStamp - pt) / 1000;
      px = e.clientX;
      py = e.clientY;
      pt = e.timeStamp;
      moved += Math.abs(dx) + Math.abs(dy);
      ry += dx * 0.55;
      // On touch screens an up or down swipe scrolls the page, so only a mouse tilts the card.
      if (e.pointerType !== "touch") rx = Math.max(-28, Math.min(28, rx - dy * 0.3));
      vy = vy * 0.6 + ((dx * 0.55) / dt) * 0.4;
      paint();
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("grabbing");
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      if (e.type === "pointerup" && moved < 6 && e.timeStamp - downAt < 350) return flip();
      vy = e.timeStamp - pt > 120 ? 0 : Math.max(-900, Math.min(900, vy));
      kick();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        turnTo((target ?? ry) + (e.key === "ArrowLeft" ? -30 : 30));
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      }
    };

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("keydown", key);
    // Stop animating while the card is scrolled out of view.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(stage);

    api.current = {
      flip,
      toggleSpin: () => {
        setAuto(!auto);
        vy = 0;
        target = null;
        kick();
      },
    };
    setSpinning(auto);
    paint();
    kick();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      stage.removeEventListener("keydown", key);
      api.current = null;
    };
  }, []);

  // Half the card's thickness in pixels. A raw card is thin; a graded slab is a thick plastic case.
  const half = slab ? 6 : 2;
  const layers = slab ? 11 : 5;
  const edge = Array.from({ length: layers }, (_, i) => -half + ((i + 0.5) * 2 * half) / layers);

  return (
    <div className="c3d">
      <div
        ref={stageRef}
        className={`c3d-stage${slab ? " slab" : ""}`}
        tabIndex={0}
        role="group"
        aria-roledescription="3D card viewer"
        aria-label={`3D view of ${name}. Drag to turn it, or use the left and right arrow keys. Press Enter to flip it over.`}
      >
        <div ref={cardRef} className="c3d-card" style={{ aspectRatio: String(ratio), "--half": `${half}px` } as React.CSSProperties}>
          {edge.map((z) => (
            <div key={z} className="c3d-edge" style={{ "--z": `${z.toFixed(2)}px` } as React.CSSProperties} />
          ))}
          {/* Side strips, so the card still reads as a solid object when it is edge-on. */}
          <div className="c3d-side" />
          <div className="c3d-side right" />
          <div className="c3d-face c3d-front">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={frontRef} src={front} alt={`Front of ${name}`} draggable={false} onLoad={(e) => fit(e.currentTarget)} onError={onError} />
            <span className="c3d-glare" />
          </div>
          <div className="c3d-face c3d-back">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={back} alt={`Back of ${name}`} draggable={false} onError={onError} />
            <span className="c3d-glare" />
          </div>
        </div>
        <div className="c3d-shadow" aria-hidden="true" />
      </div>
      <div className="acts">
        <button type="button" className="btn sm" onClick={() => api.current?.flip()}>Flip card</button>
        <button type="button" className="btn sm" aria-pressed={spinning} onClick={() => api.current?.toggleSpin()}>{spinning ? "Stop spinning" : "Spin"}</button>
      </div>
    </div>
  );
}
