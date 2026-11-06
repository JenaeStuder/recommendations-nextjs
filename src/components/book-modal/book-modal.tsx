"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { BookCover } from "@/components/book-cover";
import type { ScoredBook } from "@/lib/scoring";
import { DescriptionPanel } from "./description-panel";
import {
  CLOSE_MS,
  OPEN_MS,
  closeKeyframes,
  geometryFor,
  openKeyframes,
  prefersReducedMotion,
  type Box,
} from "./flip";

type Props = {
  pick: ScoredBook;
  /** Where the cover is in the list right now. The card is picked up from here. */
  fromRect: Box;
  /** Where the cover is now, asked for at the moment of closing (the page may have moved). Null if it's gone. */
  getReturnRect: () => Box | null;
  /** Called once the book is back in its place. The parent should stop rendering this modal. */
  onClosed: () => void;
};

/** A book cover is 2:3. Capped by width, by the viewport width, and by the viewport height. */
const CARD_WIDTH = "min(420px, 92vw, 61dvh)";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * A modal that looks like the book is picked up off the list and turned over: the cover is the
 * front of a card, the description is the back cover. It's a real `<dialog>` opened with
 * `showModal()`, so the browser provides the focus trap, Escape to close, the inert page behind,
 * and putting focus back on the book's button afterwards.
 */
export function BookModal({ pick, fromRect, getReturnRect, onClosed }: Props) {
  const { book, explanation } = pick;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openAnimation = useRef<Animation | null>(null);
  const closing = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  // Runs before the browser paints, so the card never flashes at its resting (centred, turned-over) spot.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const card = cardRef.current;
    const stage = stageRef.current;
    const scrim = scrimRef.current;
    if (!dialog || !card || !stage || !scrim) return;

    // The page behind must not scroll. The reserved scrollbar gutter (see globals.css) stops the
    // layout shifting when the scrollbar disappears, which would nudge the cover's return spot.
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();

    if (!prefersReducedMotion()) {
      const geometry = geometryFor(
        fromRect,
        { width: stage.clientWidth, height: stage.clientHeight },
        { width: card.offsetWidth },
      );
      scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: "ease-out" });
      openAnimation.current = card.animate(openKeyframes(geometry), { duration: OPEN_MS, easing: "linear" });
    }

    return () => {
      for (const a of [...card.getAnimations(), ...scrim.getAnimations()]) a.cancel();
      document.documentElement.style.overflow = previousOverflow;
      if (dialog.open) dialog.close(); // also returns focus to the button that opened it
    };
  }, [fromRect]);

  /** Flip back and put the book down where it came from, then tell the parent. */
  async function requestClose() {
    if (closing.current) return;
    closing.current = true;

    const card = cardRef.current;
    const stage = stageRef.current;
    const scrim = scrimRef.current;
    const target = getReturnRect();

    if (card && stage && scrim && target && target.width > 0 && !prefersReducedMotion()) {
      openAnimation.current?.finish(); // closed while still opening: jump to the end, then go back
      const geometry = geometryFor(
        target,
        { width: stage.clientWidth, height: stage.clientHeight },
        { width: card.offsetWidth },
      );
      scrim.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: CLOSE_MS * 0.8,
        easing: "ease-in",
        fill: "forwards",
      });
      try {
        await card.animate(closeKeyframes(geometry), { duration: CLOSE_MS, easing: "linear", fill: "forwards" })
          .finished;
      } catch {
        // Cancelled (the modal was unmounted mid-flight). Nothing left to animate.
      }
    }
    onClosed();
  }

  const meta = [
    book.firstPublishYear,
    book.pages ? `${book.pages} pages` : undefined,
    book.rating ? `${book.rating.toFixed(1)} from ${book.ratingsCount} ratings` : undefined,
  ].filter(Boolean);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape: take over so the book is put back instead of vanishing.
      onCancel={(e) => {
        e.preventDefault();
        void requestClose();
      }}
      // The browser can still close it itself (e.g. a second Escape press): don't leave a stuck modal.
      // `close` fires a moment AFTER dialog.close(). In development React mounts, unmounts and remounts
      // effects once, so a stale event from that cleanup arrives when the dialog has already been
      // reopened. Only a dialog that is genuinely closed counts.
      onClose={() => {
        if (dialogRef.current?.open || closing.current) return;
        closing.current = true;
        onClosed();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-ink backdrop:bg-transparent"
    >
      {/* A plain dim. Not blurred: a backdrop blur is re-computed on every frame while this fades. */}
      <div ref={scrimRef} aria-hidden="true" className="absolute inset-0 bg-ink/55" />

      {/* Clicking the dimmed area (the stage itself, not the card) closes it. */}
      <div
        ref={stageRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) void requestClose();
        }}
        className="absolute inset-0 grid place-items-center [perspective:1600px]"
      >
        <div
          ref={cardRef}
          className="relative rounded-md will-change-transform [transform-style:preserve-3d]"
          style={{
            width: CARD_WIDTH,
            height: `calc(${CARD_WIDTH} * 1.5)`,
            // Resting state = turned over, centred. The open animation ends exactly here.
            transform: "rotateY(180deg)",
            // Static on purpose: only the transform is animated, which the browser can do on the GPU
            // without repainting. An animated shadow would be repainted on every frame.
            boxShadow: "0 28px 56px rgb(0 0 0 / 0.38)",
          }}
        >
          {/* Front: the same cover as in the list (decorative here; the back carries the content). */}
          <div aria-hidden="true" className="absolute inset-0 [backface-visibility:hidden]">
            <BookCover book={book} />
          </div>

          {/* Back cover: only visible once turned over. */}
          <section className="absolute inset-0 flex flex-col overflow-hidden rounded-md border border-line bg-surface [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-ink/25 to-transparent"
            />
            <div className="flex min-h-0 flex-1 flex-col gap-4 py-6 pr-6 pl-9">
              <header>
                <p className="text-sm text-accent">{explanation}</p>
                <h2 id={titleId} className="mt-1 font-serif text-2xl leading-tight">
                  {book.title}
                </h2>
                <p className="text-muted">{book.authors.slice(0, 2).join(", ") || "Unknown author"}</p>
                <p className="mt-1 text-sm text-muted">{meta.join(", ")}</p>
              </header>

              <div className="relative min-h-0 flex-1">
                <div
                  id={bodyId}
                  role="region"
                  aria-label="Description"
                  tabIndex={0}
                  className={`h-full overflow-y-auto overscroll-contain rounded-sm pb-6 ${FOCUS}`}
                >
                  <DescriptionPanel book={book} />
                </div>
                {/* Text that runs off the bottom dissolves instead of being sliced: the cue that this area
                    scrolls (it matters on phones, where the card is short). A plain gradient overlay,
                    cheaper than a CSS mask on a layer that is turning in 3D. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent"
                />
              </div>

              <footer>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => void requestClose()}
                  className={`rounded-full border border-ink px-5 py-2 ${FOCUS}`}
                >
                  Close
                </button>
              </footer>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  );
}
