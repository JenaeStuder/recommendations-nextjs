"use client";

import { motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { useRef, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { BookModal } from "@/components/book-modal/book-modal";
import { toBox, type Box } from "@/components/book-modal/flip";
import type { Feedback, ScoredBook } from "@/lib/scoring";
import { reactionFor } from "./gesture";

/** Where each reaction sends the card, in px. */
const FLING = 700;
export const EXIT_TARGET: Record<Feedback, { x: number; y: number }> = {
  like: { x: FLING, y: 0 },
  skip: { x: -FLING, y: 0 },
  save: { x: 0, y: -FLING },
};

type Props = {
  pick: ScoredBook;
  onDecide: (action: Feedback) => void;
};

const STAMP =
  "pointer-events-none absolute top-5 rounded-md border-2 px-2.5 py-0.5 text-lg font-semibold uppercase tracking-wide";

/** The top card of the deck: drag it left, right or up, or use the buttons and arrow keys around it. */
export function DeckCard({ pick, onDecide }: Props) {
  const { book, explanation } = pick;
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], reduced ? [0, 0] : [-12, 12]);
  // The stamps fade in as the card is pulled towards that side.
  const likeOpacity = useTransform(x, [30, 110], [0, 1]);
  const skipOpacity = useTransform(x, [-110, -30], [1, 0]);
  const saveOpacity = useTransform(y, [-110, -30], [1, 0]);

  const coverRef = useRef<HTMLDivElement>(null);
  const [fromRect, setFromRect] = useState<Box | null>(null);

  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    const reaction = reactionFor(info.offset, info.velocity);
    if (reaction) onDecide(reaction);
  };

  const meta = [
    book.firstPublishYear,
    book.pages ? `${book.pages} pages` : undefined,
    book.rating ? `${book.rating.toFixed(1)} from ${book.ratingsCount} ratings` : undefined,
  ].filter(Boolean);

  return (
    <motion.article
      aria-label={`${book.title}, ${book.authors[0] ?? "unknown author"}`}
      data-deck-card
      drag
      dragSnapToOrigin
      dragElastic={0.6}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      style={{ x, y, rotate }}
      initial={{ scale: 0.96 }}
      animate={{ scale: 1 }}
      variants={{
        // `action` comes from <AnimatePresence custom>, so the card flies the way it was sent.
        leave: (action: Feedback) => ({
          ...EXIT_TARGET[action],
          opacity: 0,
          transition: reduced ? { duration: 0 } : { duration: 0.32, ease: [0.4, 0, 0.9, 0.6] },
        }),
      }}
      exit="leave"
      whileDrag={{ cursor: "grabbing" }}
      className="absolute inset-0 flex cursor-grab touch-none select-none flex-col items-center overflow-hidden rounded-xl border border-line bg-surface p-4 text-center shadow-[0_18px_40px_rgb(0_0_0/0.18)]"
    >
      <div ref={coverRef} className={`aspect-[2/3] h-[46%] shrink-0 ${fromRect ? "invisible" : ""}`}>
        <BookCover book={book} />
      </div>

      <h3 className="mt-4 line-clamp-2 font-serif text-2xl leading-snug">{book.title}</h3>
      <p className="text-muted">{book.authors.slice(0, 2).join(", ") || "Unknown author"}</p>
      <p className="mt-1 text-sm text-muted">{meta.join(", ")}</p>
      <p className="mt-2 line-clamp-2 text-sm text-accent">{explanation}</p>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => coverRef.current && setFromRect(toBox(coverRef.current.getBoundingClientRect()))}
        className="mt-auto cursor-pointer rounded-full px-3 py-1 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Read the back cover
      </button>

      {/* Decorative: the buttons and the live region say the same thing in words. */}
      <motion.span aria-hidden="true" style={{ opacity: likeOpacity }} className={`${STAMP} left-5 -rotate-12 border-accent text-accent`}>
        Like
      </motion.span>
      <motion.span aria-hidden="true" style={{ opacity: skipOpacity }} className={`${STAMP} right-5 rotate-12 border-muted text-muted`}>
        Skip
      </motion.span>
      <motion.span aria-hidden="true" style={{ opacity: saveOpacity }} className={`${STAMP} left-1/2 -translate-x-1/2 border-ink text-ink`}>
        Save
      </motion.span>

      {fromRect && (
        <BookModal
          pick={pick}
          fromRect={fromRect}
          getReturnRect={() => (coverRef.current ? toBox(coverRef.current.getBoundingClientRect()) : null)}
          onClosed={() => setFromRect(null)}
        />
      )}
    </motion.article>
  );
}
