"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { QuestionFlow } from "@/components/question-flow/question-flow";
import { SharedShelf } from "@/components/shelves/shared-shelf";
import { Shelves } from "@/components/shelves/shelves";
import { parseShelf } from "@/lib/share";
import { useShelf } from "@/lib/shelf-store";

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
      <div className="mb-10 flex items-center justify-between gap-4">
        <h1 className="font-serif text-lg text-muted">Find your next book</h1>
        <button
          ref={toggleRef}
          type="button"
          aria-pressed={showShelves}
          onClick={() => setShowShelves((v) => !v)}
          className={`cursor-pointer rounded-full border border-ink px-4 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
            showShelves ? "bg-ink text-paper" : ""
          }`}
        >
          My shelves{hydrated && count > 0 ? ` (${count})` : ""}
        </button>
      </div>
      {/* Kept mounted (just hidden) so answers, results and the deck are exactly as you left them. */}
      <div hidden={showShelves || showShared}>
        <QuestionFlow />
      </div>
      {showShelves && <Shelves headingRef={headingRef} />}
      {showShared && shared && <SharedShelf shelf={shared} headingRef={sharedHeadingRef} onClose={closeShared} />}
    </>
  );
}
