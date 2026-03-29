"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const AUTO_MS = 5200;
const PAUSE_AFTER_INTERACTION_MS = 8500;

type Props = {
  children: ReactNode;
  variant: "favorites" | "categories";
};

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M11 4L6 9l5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M7 4l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomeV2Slider({ children, variant }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const pauseUntilRef = useRef(0);
  const hoverRef = useRef(false);
  const inViewRef = useRef(false);

  const updateNav = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setAtStart(scrollLeft <= 6);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 6);
  }, []);

  const scrollStep = useCallback((dir: -1 | 1) => {
    const el = viewportRef.current;
    if (!el) return;
    const step = Math.max(200, el.clientWidth * 0.72);
    el.scrollBy({ left: step * dir });
  }, []);

  const autoAdvance = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    if (!inViewRef.current || hoverRef.current || document.visibilityState !== "visible") return;
    if (Date.now() < pauseUntilRef.current) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    if (scrollWidth <= clientWidth + 8) return;
    const atEndNow = scrollLeft + clientWidth >= scrollWidth - 8;
    if (atEndNow) {
      el.scrollTo({ left: 0 });
    } else {
      scrollStep(1);
    }
  }, [scrollStep]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    updateNav();
    el.addEventListener("scroll", updateNav, { passive: true });
    const ro = new ResizeObserver(updateNav);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateNav);
      ro.disconnect();
    };
  }, [updateNav]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        inViewRef.current = Boolean(e?.isIntersecting);
      },
      { threshold: 0.2 }
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(autoAdvance, AUTO_MS);
    return () => window.clearInterval(id);
  }, [autoAdvance]);

  const bumpPause = useCallback(() => {
    pauseUntilRef.current = Date.now() + PAUSE_AFTER_INTERACTION_MS;
  }, []);

  const scrollDir = (dir: -1 | 1) => {
    bumpPause();
    scrollStep(dir);
  };

  const trackClass =
    variant === "favorites"
      ? "home-v2-slider-track home-v2-slider-track--favorites"
      : "home-v2-slider-track home-v2-slider-track--categories";

  return (
    <div
      ref={rootRef}
      className="home-v2-slider"
      onMouseEnter={() => {
        hoverRef.current = true;
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
      }}
      onFocusCapture={() => {
        hoverRef.current = true;
        bumpPause();
      }}
      onBlurCapture={() => {
        requestAnimationFrame(() => {
          if (!rootRef.current?.contains(document.activeElement)) {
            hoverRef.current = false;
          }
        });
      }}
    >
      <div className="home-v2-slider-bar" role="group" aria-label="Slide controls">
        <button
          type="button"
          className="home-v2-slider-btn"
          aria-label="Previous"
          disabled={atStart}
          onClick={() => scrollDir(-1)}
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          className="home-v2-slider-btn"
          aria-label="Next"
          disabled={atEnd}
          onClick={() => scrollDir(1)}
        >
          <ChevronRight />
        </button>
      </div>
      <div
        className="home-v2-slider-viewport"
        ref={viewportRef}
        onWheel={bumpPause}
        onPointerDown={bumpPause}
        onTouchStart={bumpPause}
      >
        <div className={trackClass}>{children}</div>
      </div>
    </div>
  );
}
