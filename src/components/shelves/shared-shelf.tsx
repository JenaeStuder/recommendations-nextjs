"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ReactionButtons } from "@/components/reaction-buttons";
import { booksByIdsQueryOptions, errorMessage } from "@/lib/open-library";
import { LIST_TITLES, orderByIds, type SharedShelf as Shared } from "@/lib/share";
import { useShelf } from "@/lib/shelf-store";

const LINK =
  "underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const BUTTON =
  "cursor-pointer rounded-full px-5 py-2.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-default disabled:opacity-50";

function Skeleton({ count }: { count: number }) {
  return (
    <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: Math.min(count, 8) }, (_, i) => (
        <li key={i} className="flex gap-4">
          <div className="aspect-[2/3] w-16 shrink-0 animate-pulse rounded-sm bg-line" />
          <div className="flex-1 space-y-3 pt-1">
            <div className="h-5 w-2/3 animate-pulse rounded bg-line" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
          </div>
        </li>
      ))}
    </ul>
  );
}

type Props = {
  shelf: Shared;
  headingRef: React.Ref<HTMLHeadingElement>;
  /** Leave the shared shelf and go to the question flow. */
  onClose: () => void;
};

/** What opens when someone follows a shared link: the books on it, which they can like or save into their own shelves. */
export function SharedShelf({ shelf, headingRef, onClose }: Props) {
  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    ...booksByIdsQueryOptions(shelf.ids),
    enabled: shelf.ids.length > 0,
  });
  const reactions = useShelf((s) => s.reactions);
  const setFlag = useShelf((s) => s.set);
  const [added, setAdded] = useState<number>();

  const { ordered, missing } = useMemo(() => (data ? orderByIds(data, shelf.ids) : { ordered: [], missing: [] }), [data, shelf.ids]);
  const notSaved = ordered.filter((b) => !reactions[b.id]?.saved);

  const addAll = () => {
    for (const b of notSaved) setFlag(b, "saved", true);
    setAdded(notSaved.length);
  };

  const noBooks = shelf.ids.length === 0 || (data && ordered.length === 0);
  const name = shelf.list ? LIST_TITLES[shelf.list] : undefined;

  return (
    <section aria-labelledby="shared-heading" aria-busy={isPending && shelf.ids.length > 0}>
      <h2 id="shared-heading" ref={headingRef} tabIndex={-1} className="font-serif text-3xl outline-none">
        A shared shelf
      </h2>
      <p className="mt-2 text-muted">
        {name ? `Someone shared their “${name}” list with you.` : "Someone shared a list of books with you."} Like or save
        any of them to keep them in your own shelves.
      </p>

      {isPending && shelf.ids.length > 0 && <Skeleton count={shelf.ids.length} />}

      {isError && (
        <div role="alert" className="mt-6 rounded-md border border-line bg-surface p-5">
          <p>{errorMessage(error)}</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BUTTON} mt-4 bg-ink text-paper`}
          >
            {isFetching ? "Trying…" : "Try again"}
          </button>
        </div>
      )}

      {noBooks && (
        <div role="status" className="mt-6 rounded-md border border-dashed border-line p-5">
          <p>
            {shelf.ids.length === 0
              ? "This link doesn’t have any books in it. It may have been cut short when it was copied."
              : "We couldn’t find any of the books on this link on Open Library."}
          </p>
        </div>
      )}

      {ordered.length > 0 && (
        <>
          <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 lg:grid-cols-4">
            {ordered.map((book) => (
              <li key={book.id} className="flex gap-4">
                <div className="w-20 shrink-0">
                  <BookCover book={book} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif text-lg leading-snug">{book.title}</h3>
                  <p className="text-sm text-muted">{book.authors.slice(0, 2).join(", ") || "Unknown author"}</p>
                  <p className="mt-1 text-sm">
                    <a href={`https://openlibrary.org/works/${book.id}`} target="_blank" rel="noreferrer" className={LINK}>
                      Open Library<span className="sr-only"> page for {book.title} (opens in a new tab)</span>
                    </a>
                  </p>
                  <div className="mt-3">
                    <ReactionButtons
                      liked={Boolean(reactions[book.id]?.liked)}
                      saved={Boolean(reactions[book.id]?.saved)}
                      onToggle={(flag, value) => setFlag(book, flag, value)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {(missing.length > 0 || shelf.ignored > 0) && (
            <p className="mt-6 text-sm text-muted">
              {missing.length > 0 &&
                `${missing.length} ${missing.length === 1 ? "book" : "books"} on this link couldn’t be found. `}
              {shelf.ignored > 0 &&
                `${shelf.ignored} ${shelf.ignored === 1 ? "entry" : "entries"} in the link ${shelf.ignored === 1 ? "wasn’t" : "weren’t"} valid and ${shelf.ignored === 1 ? "was" : "were"} skipped.`}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={addAll} disabled={notSaved.length === 0} className={`${BUTTON} bg-ink text-paper`}>
              {notSaved.length === 0 ? "All saved to your To read" : `Save all ${notSaved.length} to my To read`}
            </button>
            {/* A polite live region so the result of the button is announced. */}
            <p role="status" className="text-sm text-muted">
              {added !== undefined && added > 0 && `Saved ${added} ${added === 1 ? "book" : "books"} to your To read shelf.`}
            </p>
          </div>
        </>
      )}

      <div className="mt-10 flex justify-end">
        <button type="button" onClick={onClose} className={`${BUTTON} border border-ink`}>
          Find my own books
        </button>
      </div>
    </section>
  );
}
