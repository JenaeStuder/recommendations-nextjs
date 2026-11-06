"use client";

import { useEffect, useId, useRef, useState } from "react";

export type Suggestion = { id: string; label: string; detail?: string };

type Props = {
  label: string;
  description?: string;
  placeholder?: string;
  /** Text in the input. Controlled by the parent so it can debounce and fetch. */
  value: string;
  onValueChange: (value: string) => void;
  suggestions: Suggestion[];
  status: "idle" | "loading" | "error" | "done";
  /** Minimum characters before the list opens. */
  minChars?: number;
  onSelect: (suggestion: Suggestion) => void;
  /** When set, the field shows this choice instead of the input. */
  selected?: Suggestion;
  onClear: () => void;
};

/**
 * Editable combobox with list autocomplete (WAI-ARIA 1.2): focus stays in the input,
 * the highlighted option is exposed through aria-activedescendant.
 */
export function Combobox({
  label,
  description,
  placeholder,
  value,
  onValueChange,
  suggestions,
  status,
  minChars = 3,
  onSelect,
  selected,
  onClear,
}: Props) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const descId = `${uid}-desc`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const hadSelection = useRef(false);

  // Don't leave keyboard users stranded when the input swaps for the chosen card and back.
  useEffect(() => {
    if (selected) clearRef.current?.focus();
    else if (hadSelection.current) inputRef.current?.focus();
    hadSelection.current = Boolean(selected);
  }, [selected]);

  const long = value.trim().length >= minChars;
  const showList = open && long;

  // Resetting the highlight when the options change is "adjusting state on prop change";
  // doing it during render avoids an extra effect pass (see react.dev: You Might Not Need an Effect).
  const [prevSuggestions, setPrevSuggestions] = useState(suggestions);
  if (prevSuggestions !== suggestions) {
    setPrevSuggestions(suggestions);
    setActive(-1);
  }

  const choose = (s: Suggestion) => {
    setOpen(false);
    setActive(-1);
    onSelect(s);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = suggestions.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!showList) setOpen(true);
        if (count > 0) setActive((i) => (i + 1) % count);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!showList) setOpen(true);
        if (count > 0) setActive((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case "Enter":
        // While the list is showing, Enter picks (or does nothing) rather than submitting the form
        // and skipping ahead with text the user hasn't confirmed.
        if (showList) {
          e.preventDefault();
          if (active >= 0 && suggestions[active]) choose(suggestions[active]);
        }
        break;
      case "Escape":
        if (showList) {
          e.preventDefault();
          setOpen(false);
        }
        break;
    }
  };

  const liveMessage =
    !long ? ""
    : status === "loading" ? "Searching"
    : status === "error" ? "Couldn't load suggestions"
    : suggestions.length === 0 ? "No matches"
    : `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} available`;

  if (selected) {
    return (
      <div>
        <p className="mb-2 font-medium">{label}</p>
        <div className="flex items-center justify-between gap-3 rounded-md border border-ink bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{selected.label}</p>
            {selected.detail && <p className="truncate text-sm text-muted">{selected.detail}</p>}
          </div>
          <button
            ref={clearRef}
            type="button"
            onClick={onClear}
            aria-label={`Remove ${selected.label}`}
            className="shrink-0 rounded-full border border-line px-3 py-1 text-sm hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1 block font-medium">
        {label}
      </label>
      {description && (
        <p id={descId} className="mb-2 text-sm text-muted">
          {description}
        </p>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        aria-describedby={description ? descId : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-12 w-full rounded-md border border-line bg-surface px-4 text-base placeholder:text-muted focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      />

      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} suggestions`}
        hidden={!showList}
        className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg"
      >
        {suggestions.map((s, i) => (
          <li
            key={s.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            // mousedown (not click) fires before the input's blur closes the list.
            onMouseDown={(e) => {
              e.preventDefault();
              choose(s);
            }}
            onMouseMove={() => setActive(i)}
            className={`cursor-pointer px-4 py-2.5 ${i === active ? "bg-ink text-paper" : ""}`}
          >
            <span className="block font-medium">{s.label}</span>
            {s.detail && (
              <span className={`block text-sm ${i === active ? "text-paper/80" : "text-muted"}`}>
                {s.detail}
              </span>
            )}
          </li>
        ))}
        {status === "loading" && suggestions.length === 0 && (
          <li role="presentation" className="px-4 py-3 text-muted">Searching…</li>
        )}
        {status === "error" && (
          <li role="presentation" className="px-4 py-3 text-muted">
            Couldn&apos;t load suggestions. Keep typing to try again.
          </li>
        )}
        {status === "done" && suggestions.length === 0 && (
          <li role="presentation" className="px-4 py-3 text-muted">
            No matches. Check the spelling, or skip this one.
          </li>
        )}
      </ul>

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
    </div>
  );
}
