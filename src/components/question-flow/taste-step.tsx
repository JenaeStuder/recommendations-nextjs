"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  authorSuggestionsQueryOptions,
  bookSuggestionsQueryOptions,
  type Author,
  type Book,
} from "@/lib/open-library";
import type { Taste } from "@/lib/taste";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Combobox, type Suggestion } from "./combobox";

type Props = {
  taste: Taste;
  onBook: (book: Book | undefined) => void;
  onAuthor: (author: Pick<Author, "id" | "name"> | undefined) => void;
};

function bookDetail(b: Book): string {
  return [b.authors[0], b.firstPublishYear].filter(Boolean).join(", ");
}

function BookField({ selected, onChange }: { selected?: Book; onChange: (b?: Book) => void }) {
  const [text, setText] = useState("");
  const debounced = useDebouncedValue(text.trim());
  const query = useQuery(bookSuggestionsQueryOptions(debounced));
  const books = query.data ?? [];
  const waiting = text.trim() !== debounced || query.isFetching;

  return (
    <Combobox
      label="A book you loved"
      description="Start typing a title. We'll find books that share its themes."
      placeholder="e.g. The Hobbit"
      value={text}
      onValueChange={setText}
      suggestions={books.map((b) => ({ id: b.id, label: b.title, detail: bookDetail(b) }))}
      status={query.isError ? "error" : waiting ? "loading" : query.data ? "done" : "idle"}
      selected={selected && { id: selected.id, label: selected.title, detail: bookDetail(selected) }}
      onSelect={(s: Suggestion) => onChange(books.find((b) => b.id === s.id))}
      onClear={() => {
        onChange(undefined);
        setText("");
      }}
    />
  );
}

function AuthorField({
  selected,
  onChange,
}: {
  selected?: Pick<Author, "id" | "name">;
  onChange: (a?: Pick<Author, "id" | "name">) => void;
}) {
  const [text, setText] = useState("");
  const debounced = useDebouncedValue(text.trim());
  const query = useQuery(authorSuggestionsQueryOptions(debounced));
  const authors = query.data ?? [];
  const waiting = text.trim() !== debounced || query.isFetching;

  return (
    <Combobox
      label="An author you love"
      description="We'll include their books and look for writers who feel similar."
      placeholder="e.g. Brandon Sanderson"
      value={text}
      onValueChange={setText}
      suggestions={authors.map((a) => ({
        id: a.id,
        label: a.name,
        detail: [a.topWork && `Known for ${a.topWork}`, a.workCount && `${a.workCount} works`]
          .filter(Boolean)
          .join(", "),
      }))}
      status={query.isError ? "error" : waiting ? "loading" : query.data ? "done" : "idle"}
      selected={selected && { id: selected.id, label: selected.name }}
      onSelect={(s: Suggestion) => onChange(authors.find((a) => a.id === s.id))}
      onClear={() => {
        onChange(undefined);
        setText("");
      }}
    />
  );
}

export function TasteStep({ taste, onBook, onAuthor }: Props) {
  return (
    <div className="space-y-8">
      <BookField selected={taste.book} onChange={onBook} />
      <AuthorField selected={taste.author} onChange={onAuthor} />
    </div>
  );
}
