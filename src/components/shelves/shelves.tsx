"use client";

import { useRef } from "react";
import { BookCover } from "@/components/book-cover";
import type { Book } from "@/lib/open-library";
import { booksOn, type Flag } from "@/lib/shelf";
import { useShelf } from "@/lib/shelf-store";

const SHELVES: { flag: Flag; title: string; empty: string }[] = [
  {
    flag: "saved",
    title: "To read",
    empty: "Nothing saved yet. Press Save on a book you want to read later.",
  },
  {
    flag: "liked",
    title: "Liked",
    empty: "No likes yet. Press Like on books that look like your kind of thing.",
  },
];

function Shelf({ flag, title, empty }: (typeof SHELVES)[number]) {
  const reactions = useShelf((s) => s.reactions);
  const setFlag = useShelf((s) => s.set);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const books = booksOn(reactions, flag);

  const onRemove = (book: Book) => {
    setFlag(book, flag, false);
    // The button the user pressed is about to disappear, so keep their place at the top of this shelf.
    headingRef.current?.focus();
  };

  return (
    <section aria-labelledby={`shelf-${flag}`} className="mt-10">
      <h3 id={`shelf-${flag}`} ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none">
        {title} <span className="text-base text-muted">({books.length})</span>
      </h3>
      {books.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-line p-5 text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2 lg:grid-cols-4">
          {books.map((book) => (
            <li key={book.id} className="flex gap-4">
              <div className="w-16 shrink-0">
                <BookCover book={book} />
              </div>
              <div className="min-w-0">
                <p className="font-serif text-lg leading-snug">{book.title}</p>
                <p className="text-sm text-muted">{book.authors.slice(0, 2).join(", ") || "Unknown author"}</p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <a
                    href={`https://openlibrary.org/works/${book.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    Open Library<span className="sr-only"> page for {book.title} (opens in a new tab)</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemove(book)}
                    className="cursor-pointer text-muted underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    Remove<span className="sr-only"> {book.title} from {title}</span>
                  </button>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The saved and liked books. They live in localStorage, so they are still here next visit. */
export const Shelves = ({ headingRef }: { headingRef: React.Ref<HTMLHeadingElement> }) => (
  <section aria-labelledby="shelves-heading">
    <h2 id="shelves-heading" ref={headingRef} tabIndex={-1} className="font-serif text-3xl outline-none">
      My shelves
    </h2>
    <p className="mt-2 text-muted">Saved on this device only. Clearing your browser data removes them.</p>
    {SHELVES.map((s) => (
      <Shelf key={s.flag} {...s} />
    ))}
  </section>
);
