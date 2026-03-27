"use client";

import { useEffect, useState } from "react";

const HERO_TEXT = "Stay somewhere with presence.";

export default function TypingHeroTitle() {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(HERO_TEXT.slice(0, index));

      if (index >= HERO_TEXT.length) {
        window.clearInterval(timer);
      }
    }, 55);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <h1 className="hero-title">
      {visibleText}
      <span className="hero-caret" aria-hidden="true">
        |
      </span>
    </h1>
  );
}
