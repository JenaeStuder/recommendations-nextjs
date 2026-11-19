"use client";

import { useState, useSyncExternalStore } from "react";
import { THEME_KEY, THEME_LABEL, applyTheme, nextTheme, parseTheme, type Theme } from "@/lib/theme";

const CHANGE = "themechange";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "system"; // storage blocked
  }
}

/**
 * One button that cycles Auto, Light, Dark. The visible text names the current choice. The <html>
 * attribute itself is set before first paint by THEME_INIT_SCRIPT; this just keeps it in step.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // "system" on the server and during hydration, then the stored choice.
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  // Only spoken after the person presses the button, never when a saved choice is restored on load.
  const [announcement, setAnnouncement] = useState("");

  const change = () => {
    const next = nextTheme(theme);
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage is blocked: the choice still applies for this visit, it just isn't remembered.
    }
    applyTheme(next);
    setAnnouncement(`Theme set to ${THEME_LABEL[next].toLowerCase()}.`);
    window.dispatchEvent(new Event(CHANGE));
  };

  return (
    <>
      <button type="button" onClick={change} className={className}>
        Theme: {THEME_LABEL[theme]}
      </button>
      {/* The button's text changes under the person's finger; say so for screen readers. */}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
