"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ReactionButtons } from "@/components/reaction-buttons";
import { SwipeDeck } from "@/components/swipe-deck/swipe-deck";
import { BookModal } from "@/components/book-modal/book-modal";
import { toBox, type Box } from "@/components/book-modal/flip";
import { EMPTY_DECK, decide, undo, upcoming, type DeckState } from "@/lib/deck";
import { descriptionQueryOptions, errorMessage } from "@/lib/open-library";
import type { Answers } from "@/lib/questions";
import type { Taste } from "@/lib/taste";
import { recommendationQueryOptions } from "@/lib/recommend";
import { useShelf } from "@/lib/shelf-store";
import type { Flag } from "@/lib/shelf";
import { rankBooks, toPreferences, type Feedback, type ScoredBook } from "@/lib/scoring";

/** How many books to reveal at a time. */
const PAGE_SIZE = 20;

const BUTTON_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

type Props = {
  answers: Answers;
  taste: Taste;
  /** Clears everything and goes back to the first screen. */
  onNewSearch: () => void;
};

function Skeleton() {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex gap-4 md:flex-col">
          <div className="aspect-[2/3] w-24 shrink-0 animate-pulse rounded-sm bg-line md:w-36" />
          <div className="flex-1 space-y-3 pt-1">
            <div className="h-5 w-2/3 animate-pulse rounded bg-line" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** How long the pointer must rest on a book before we start loading its description. */
const HOVER_PREFETCH_MS = 250;

type RowProps = {
  pick: ScoredBook;
  index: number;
  liked: boolean;
  saved: boolean;
  onToggle: (book: ScoredBook["book"], flag: Flag, value: boolean) => void;
};

function BookRow({ pick, index, liked, saved, onToggle }: RowProps) {
  const { book, explanation } = pick;
  // Where the cover was when it was picked up. While set, the modal is open and the cover is hidden.
  const [fromRect, setFromRect] = useState<Box | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queryClient = useQueryClient();

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // The flip is only as good as the back cover having text on it, and the request takes 1 to 2 s.
  // Start it early, but only for books the user lingers on (or focuses with the keyboard), so
  // skimming the list doesn't fire a request per row.
  const prefetch = () => void queryClient.prefetchQuery(descriptionQueryOptions(book.id));

  const openModal = () => {
    if (coverRef.current) setFromRect(toBox(coverRef.current.getBoundingClientRect()));
  };

  const meta = [
    book.firstPublishYear,
    book.pages ? `${book.pages} pages` : undefined,
    book.rating ? `${book.rating.toFixed(1)} from ${book.ratingsCount} ratings` : undefined,
  ].filter(Boolean);

  return (
    <li>
      {/* The title is the real button; its ::after stretches over this whole row so the row is
          clickable with a mouse too. */}
      <div className="relative flex gap-4 rounded-md md:flex-col has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-4 has-[button:focus-visible]:outline-ink">
        {/* Hidden (but still taking up its space) while the book is "picked up", so there's a gap on the shelf. */}
        <div ref={coverRef} className={`w-24 shrink-0 md:w-36 ${fromRect ? "invisible" : ""}`}>
          <BookCover book={book} />
        </div>
        <div className="min-w-0 pt-1">
          {/* Focusable (not tabbable) so "Show me more" can move focus to the first new book. */}
          <h3
            data-book-index={index}
            tabIndex={-1}
            className="font-serif text-xl leading-snug outline-none"
          >
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={openModal}
              onPointerEnter={() => {
                hoverTimer.current = setTimeout(prefetch, HOVER_PREFETCH_MS);
              }}
              onPointerLeave={() => clearTimeout(hoverTimer.current)}
              onFocus={prefetch}
              className="cursor-pointer text-left outline-none after:absolute after:inset-0 hover:underline"
            >
              {book.title}
            </button>
          </h3>
          <p className="text-muted">{book.authors.slice(0, 2).join(", ") || "Unknown author"}</p>
          <p className="mt-1 text-sm text-muted">{meta.join(", ")}</p>
          <p className="mt-2 text-sm text-accent">{explanation}</p>
          <p aria-hidden="true" className="mt-2 text-sm text-muted">
            Read the back cover
          </p>
          <div className="mt-3">
            <ReactionButtons liked={liked} saved={saved} onToggle={(flag, value) => onToggle(book, flag, value)} />
          </div>
        </div>
      </div>

      {fromRect && (
        <BookModal
          pick={pick}
          fromRect={fromRect}
          getReturnRect={() => (coverRef.current ? toBox(coverRef.current.getBoundingClientRect()) : null)}
          onClosed={() => setFromRect(null)}
        />
      )}
    </li>
  );
}

export function Results({ answers, taste, onNewSearch }: Props) {
  const { data, error, isPending, isError, refetch, isFetching } = useQuery(
    recommendationQueryOptions(answers, taste),
  );
  // Rank the whole pool once and reveal it a page at a time: showing more needs no new requests,
  // and ranking stays separate from fetching (so re-ranking later won't refetch).
  const picks = useMemo(
    () => (data ? rankBooks(data, toPreferences(answers, taste, data), {}, { limit: Infinity }) : []),
    [data, answers, taste],
  );

  // The swipe deck keeps its own state here (not inside the deck) so flipping to the list and back
  // doesn't lose what the user has already liked, skipped and saved.
  const [view, setView] = useState<"grid" | "deck">("grid");
  const [deck, setDeck] = useState<DeckState>(EMPTY_DECK);
  const prefs = useMemo(() => (data ? toPreferences(answers, taste, data) : undefined), [data, answers, taste]);
  // Likes and saves are kept in localStorage and shared by both views.
  const reactions = useShelf((s) => s.reactions);
  const setShelfFlag = useShelf((s) => s.set);
  const reactedIds = useMemo(() => new Set(Object.keys(reactions)), [reactions]);
  const deckUpcoming = useMemo(
    () => (data && prefs ? upcoming(data, prefs, deck, reactedIds) : []),
    [data, prefs, deck, reactedIds],
  );

  /** One place for every like and save, from either view, so learning and storage never disagree. */
  const react = (book: ScoredBook["book"], action: Feedback) => {
    if (action !== "skip") setShelfFlag(book, action === "like" ? "liked" : "saved", true);
    setDeck((d) => decide(d, book, action));
  };
  const onToggle = (book: ScoredBook["book"], flag: Flag, value: boolean) => {
    if (value) react(book, flag === "liked" ? "like" : "save");
    else setShelfFlag(book, flag, false);
  };
  const onDeckUndo = () => {
    const { state, entry } = undo(deck);
    setDeck(state);
    if (entry && entry.action !== "skip") setShelfFlag(entry.book, entry.action === "like" ? "liked" : "saved", false);
  };

  const [requested, setRequested] = useState(PAGE_SIZE);
  const shown = picks.slice(0, requested);
  const remaining = picks.length - shown.length;
  const nextBatch = Math.min(PAGE_SIZE, remaining);

  // After revealing more, move focus to the first new book so keyboard and screen-reader
  // users carry on reading from there instead of being left on a button that may have gone.
  const focusIndex = useRef<number | null>(null);
  useEffect(() => {
    if (focusIndex.current === null) return;
    document.querySelector<HTMLElement>(`[data-book-index="${focusIndex.current}"]`)?.focus();
    focusIndex.current = null;
  }, [shown.length]);

  const showMore = () => {
    focusIndex.current = shown.length; // index of the first book about to appear
    setRequested((n) => n + PAGE_SIZE);
  };

  return (
    <section aria-labelledby="results-heading" aria-busy={isPending}>
      <h2 id="results-heading" data-step-heading tabIndex={-1} className="font-serif text-3xl outline-none">
        {isPending ? "Looking through the shelves…" : "Your picks"}
      </h2>

      {(taste.book || taste.author) && (
        <p className="mt-2 text-muted">
          Based on {[taste.book && `${taste.book.title}`, taste.author?.name].filter(Boolean).join(" and ")}.
        </p>
      )}

      <div className="mt-6">
        {isPending && <Skeleton />}

        {isError && (
          <div role="alert" className="rounded-md border border-line bg-surface p-5">
            <p>{errorMessage(error)}</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={`mt-4 rounded-full bg-ink px-5 py-2 text-paper disabled:opacity-60 ${BUTTON_FOCUS}`}
            >
              {isFetching ? "Trying…" : "Try again"}
            </button>
          </div>
        )}

        {data && picks.length === 0 && (
          <div role="status" className="rounded-md border border-line bg-surface p-5">
            <p>We couldn&apos;t find books for that mix, even after widening the search. Try a different book or genre, or skip the length and era questions.</p>
          </div>
        )}

        {data && picks.length > 0 && (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              {view === "grid" ? (
                /* A polite live region: screen readers hear the new count after each "Show me more". */
                <p role="status" className="text-muted">
                  Showing {shown.length} of {picks.length} books we found, ranked for you.
                </p>
              ) : (
                <p className="text-muted">One book at a time. What you like and skip shapes what comes next.</p>
              )}
              <div role="group" aria-label="How to browse" className="flex rounded-full border border-ink p-0.5">
                {(
                  [
                    ["grid", "List"],
                    ["deck", "Swipe"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={view === id}
                    onClick={() => setView(id)}
                    className={`cursor-pointer rounded-full px-4 py-1.5 text-sm ${
                      view === id ? "bg-ink text-paper" : ""
                    } ${BUTTON_FOCUS}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {view === "deck" && (
              <SwipeDeck
                upcoming={deckUpcoming}
                state={deck}
                onDecide={react}
                onUndo={onDeckUndo}
                onShowList={() => setView("grid")}
              />
            )}
            {view === "grid" && <ul className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
              {shown.map((pick, i) => (
                <BookRow
                  key={pick.book.id}
                  pick={pick}
                  index={i}
                  liked={Boolean(reactions[pick.book.id]?.liked)}
                  saved={Boolean(reactions[pick.book.id]?.saved)}
                  onToggle={onToggle}
                />
              ))}
            </ul>}

          </>
        )}
      </div>

      {/* "Start A New Search" has ml-auto, so it stays at the far right even when the left side is empty. */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        {data && picks.length > 0 && view === "grid" && (
          remaining > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={showMore}
                className={`rounded-full bg-ink px-6 py-2.5 font-medium text-paper ${BUTTON_FOCUS}`}
              >
                Show me more
              </button>
              <span className="text-sm text-muted">
                {nextBatch === remaining ? `The last ${remaining}` : `${remaining} more to see`}
              </span>
            </div>
          ) : (
            picks.length > PAGE_SIZE && (
              <p className="text-muted">
                That&apos;s everything we found.
              </p>
            )
          )
        )}
        <button
          type="button"
          onClick={onNewSearch}
          className={`ml-auto rounded-full border border-ink px-5 py-2.5 ${BUTTON_FOCUS}`}
        >
          Start A New Search
        </button>
      </div>
    </section>
  );
}
