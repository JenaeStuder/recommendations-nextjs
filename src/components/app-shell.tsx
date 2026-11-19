"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuestionFlow } from "@/components/question-flow/question-flow";
import { SharedShelf } from "@/components/shelves/shared-shelf";
import { Shelves } from "@/components/shelves/shelves";
import { parseShelf } from "@/lib/share";
import { SITE_NAME } from "@/lib/site";
import { useShelf } from "@/lib/shelf-store";

const HEADER_BUTTON =
  "cursor-pointer whitespace-nowrap rounded-full border px-4 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** False while rendering on the server and during hydration, true afterwards (the shelf lives in localStorage). */
const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

export function AppShell() {
  const [showShelves, setShowShelves] = useState(false);
  // A shared link (?shelf=…) opens the shared shelf first. Closing it drops the parameters from the address.
  const params = useSearchParams();
  const shared = useMemo(() => parseShelf(params), [params]);
  const [dismissed, setDismissed] = useState(false);
  const showShared = Boolean(shared) && !dismissed && !showShelves;
  const sharedHeadingRef = useRef<HTMLHeadingElement>(null);
  const closeShared = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setDismissed(true);
  };
  // After leaving the shared shelf, land on the first question's heading instead of nowhere.
  useEffect(() => {
    if (dismissed) document.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [dismissed]);
  const hydrated = useHydrated();
  const count = useShelf((s) => Object.keys(s.reactions).length);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  // Move focus to the shelves heading when they open, and back to the button when they close.
  useEffect(() => {
    if (showShelves) {
      opened.current = true;
      headingRef.current?.focus();
    } else if (opened.current) {
      toggleRef.current?.focus();
    }
  }, [showShelves]);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:mb-5">
        <h1 className="font-serif text-lg whitespace-nowrap text-muted">{SITE_NAME}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle className={`${HEADER_BUTTON} border-edge`} />
          <button
            ref={toggleRef}
            type="button"
            aria-pressed={showShelves}
            onClick={() => setShowShelves((v) => !v)}
            className={`${HEADER_BUTTON} border-ink ${showShelves ? "bg-ink text-paper" : ""}`}
          >
            My shelves{hydrated && count > 0 ? ` (${count})` : ""}
          </button>
        </div>
      </header>
      {/* The skip link in the layout lands here. tabIndex -1 lets it take focus without joining the tab order. */}
      <main id="main" tabIndex={-1} className="outline-none">
        {/* Kept mounted (just hidden) so answers, results and the deck are exactly as you left them. */}
        <div hidden={showShelves || showShared}>
          <QuestionFlow />
        </div>
        {showShelves && <Shelves headingRef={headingRef} />}
        {showShared && shared && <SharedShelf shelf={shared} headingRef={sharedHeadingRef} onClose={closeShared} />}
      </main>
    </>
  );
}
