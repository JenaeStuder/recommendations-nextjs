"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookCover } from "@/components/book-cover";
import { booksWith, type DeckState } from "@/lib/deck";
import type { Feedback, ScoredBook } from "@/lib/scoring";
import { DeckCard } from "./deck-card";

type Props = {
  /** Cards still to come, best first. */
  upcoming: ScoredBook[];
  state: DeckState;
  onDecide: (book: ScoredBook["book"], action: Feedback) => void;
  onUndo: () => void;
  onShowList: () => void;
};

const BUTTON =
  "cursor-pointer rounded-full px-5 py-2.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-default disabled:opacity-40";

/** The undo toast stays this long, and pauses while the pointer or focus is on it. */
const TOAST_MS = 7000;

const VERB: Record<Feedback, string> = { like: "Liked", skip: "Skipped", save: "Saved" };

export function SwipeDeck({ upcoming, state, onDecide, onUndo, onShowList }: Props) {
  const top = upcoming[0];
  const next = upcoming[1];
  const total = state.entries.length + upcoming.length;

  // Which way the card that is leaving should fly. Set in the same event as the decision.
  const [leaving, setLeaving] = useState<Feedback>("like");
  const [announcement, setAnnouncement] = useState("");

  const decide = (action: Feedback) => {
    if (!top) return;
    setLeaving(action);
    setAnnouncement(`${VERB[action]} ${top.book.title}. ${upcoming.length - 1} left.`);
    onDecide(top.book, action);
  };

  const undo = () => {
    const last = state.entries.at(-1);
    if (!last) return;
    setAnnouncement(`Brought back ${last.book.title}.`);
    onUndo();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // The book modal is a <dialog> rendered inside this tree, so its key presses bubble up here.
    if ((e.target as HTMLElement).closest("dialog")) return;
    const key = e.key;
    if (key === "ArrowLeft") decide("skip");
    else if (key === "ArrowRight") decide("like");
    else if (key === "ArrowUp") decide("save");
    else if (key === "z" || key === "Z") undo();
    else return;
    e.preventDefault();
  };

  // The undo toast: shown while the latest decision is a skip, hidden after a few seconds.
  const last = state.entries.at(-1);
  const skipId = last?.action === "skip" ? last.book.id : undefined;
  const [dismissed, setDismissed] = useState<string>();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!skipId || paused) return;
    const timer = setTimeout(() => setDismissed(skipId), TOAST_MS);
    return () => clearTimeout(timer);
  }, [skipId, paused]);
  const toast = last && skipId && dismissed !== skipId ? last.book : undefined;

  // When the last card goes, move focus to the "all done" heading instead of dropping it on <body>.
  const hadCard = useRef(false);
  const doneRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (top) hadCard.current = true;
    else if (hadCard.current) doneRef.current?.focus();
  }, [top]);

  if (!top) {
    const liked = booksWith(state, "like");
    const saved = booksWith(state, "save");
    return (
      <div className="max-w-xl">
        <h3 ref={doneRef} tabIndex={-1} className="font-serif text-2xl outline-none">
          That&apos;s the whole deck
        </h3>
        <p className="mt-2 text-muted">
          You looked at {state.entries.length} books: {liked.length} liked, {saved.length} saved,{" "}
          {state.entries.length - liked.length - saved.length} skipped.
        </p>
        {[
          ["Saved", saved],
          ["Liked", liked],
        ].map(([label, books]) =>
          (books as typeof liked).length > 0 ? (
            <section key={label as string} className="mt-6" aria-label={label as string}>
              <h4 className="font-medium">{label as string}</h4>
              <ul className="mt-2 grid gap-2">
                {(books as typeof liked).map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <div className="w-8 shrink-0"><BookCover book={b} /></div>
                    <span>
                      <span className="font-serif">{b.title}</span>
                      <span className="text-muted"> · {b.authors[0] ?? "Unknown author"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={undo} disabled={!last} className={`${BUTTON} border border-ink`}>
            Undo last
          </button>
          <button type="button" onClick={onShowList} className={`${BUTTON} bg-ink text-paper`}>
            See the full list
          </button>
        </div>
        <p role="status" className="sr-only">{announcement}</p>
      </div>
    );
  }

  return (
    // Arrow keys work anywhere inside the deck (card, buttons), so no one has to find a special focus target.
    <div role="group" aria-label="Swipe deck" onKeyDown={onKeyDown}>
      <p id="deck-help" className="mb-4 text-sm text-muted">
        {upcoming.length} of {total} left. Drag the card, use the buttons, or press ← to skip, → to like, ↑ to save, Z to undo.
      </p>

      <div className="relative mx-auto h-[min(28rem,58dvh)] w-full max-w-sm">
        {next && (
          <div aria-hidden="true" className="absolute inset-0 scale-[0.95] rounded-xl border border-line bg-surface opacity-80" />
        )}
        <AnimatePresence custom={leaving}>
          <DeckCard key={top.book.id} pick={top} onDecide={decide} />
        </AnimatePresence>
      </div>

      {/* A reserved slot (not an overlay), so the toast never covers the buttons and the page never jumps. */}
      <div className="mt-4 h-12">
      {toast && (
        <div
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="mx-auto flex max-w-sm items-center justify-between gap-4 rounded-lg bg-ink px-4 py-2.5 text-paper"
        >
          <span className="min-w-0 truncate">Skipped {toast.title}</span>
          <button type="button" onClick={undo} className="shrink-0 cursor-pointer rounded px-2 py-1 font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper">
            Undo
          </button>
        </div>
      )}
      </div>

      <div className="mx-auto mt-2 flex max-w-sm flex-wrap items-center justify-center gap-3" aria-describedby="deck-help">
        <button type="button" onClick={() => decide("skip")} aria-keyshortcuts="ArrowLeft" className={`${BUTTON} border border-ink`}>
          Skip <span aria-hidden="true">←</span>
        </button>
        <button type="button" onClick={() => decide("save")} aria-keyshortcuts="ArrowUp" className={`${BUTTON} border border-ink`}>
          Save <span aria-hidden="true">↑</span>
        </button>
        <button type="button" onClick={() => decide("like")} aria-keyshortcuts="ArrowRight" className={`${BUTTON} bg-ink text-paper`}>
          Like <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="mt-2 text-center">
        <button type="button" onClick={undo} disabled={!last} aria-keyshortcuts="Z" className="cursor-pointer rounded-full px-3 py-1 text-sm text-muted underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-default disabled:no-underline disabled:opacity-40">
          Undo
        </button>
      </div>

      {/* Always in the page, so screen readers hear each change. */}
      <p role="status" className="sr-only">{announcement}</p>

    </div>
  );
}
