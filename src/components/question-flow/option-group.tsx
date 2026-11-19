"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Question } from "@/lib/questions";

type Props = {
  question: Question;
  selected: string[];
  onToggle: (optionId: string) => void;
  /** One chip per row. */
  stack?: boolean;
};

/**
 * Native checkboxes/radios styled as chips: keyboard, focus and screen-reader
 * behaviour come from the browser instead of being re-implemented.
 */
export function OptionGroup({ question, selected, onToggle, stack = false }: Props) {
  const multi = question.kind === "multi";
  const atMax = multi && question.max !== undefined && selected.length >= question.max;

  // Every chip in a question is as wide as its widest one, so they line up and stack evenly.
  // CSS can't size a wrapping group to its widest member, so measure each chip's natural
  // (w-max) text width, and re-measure once the web fonts have loaded.
  const groupRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => {
      const widths = [...group.querySelectorAll<HTMLElement>("[data-chip-body]")].map(
        (el) => el.getBoundingClientRect().width,
      );
      setBodyWidth(Math.ceil(Math.max(0, ...widths)));
    };
    measure();
    let cancelled = false;
    document.fonts.ready.then(() => !cancelled && measure());
    return () => {
      cancelled = true;
    };
  }, [question]);

  return (
    <div
      ref={groupRef}
      className={
        bodyWidth === null
          ? "flex flex-wrap justify-center gap-3"
          : `grid justify-center gap-3 ${
              stack
                ? "[grid-template-columns:min(var(--chip-w),100%)]"
                : "[grid-template-columns:repeat(auto-fill,min(var(--chip-w),100%))]"
            }`
      }
      // text width + the chip's px-5 padding (2 x 1.25rem) + 1px border each side
      style={bodyWidth === null ? undefined : ({ "--chip-w": `calc(${bodyWidth}px + 2.5rem + 2px)` } as React.CSSProperties)}
    >
      {question.options.map((option) => {
        const checked = selected.includes(option.id);
        const disabled = multi && atMax && !checked;
        return (
          <label
            key={option.id}
            data-chip
            className={[
              "group relative cursor-pointer select-none rounded-full border px-5 py-2.5 text-center text-base transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
              checked
                ? "border-ink bg-ink text-paper"
                : "border-edge bg-surface hover:border-ink",
              disabled ? "cursor-not-allowed opacity-45 hover:border-edge" : "",
            ].join(" ")}
          >
            <input
              type={multi ? "checkbox" : "radio"}
              name={question.id}
              value={option.id}
              checked={checked}
              disabled={disabled}
              // Radios never fire change when re-clicked; optional questions need
              // to be clearable, so single-choice toggles on click instead.
              onChange={multi ? () => onToggle(option.id) : () => {}}
              onClick={multi ? undefined : () => onToggle(option.id)}
              className="sr-only"
            />
            <span data-chip-body className="mx-auto block w-max max-w-full">
              <span className="font-medium">{option.label}</span>
              {option.hint && (
                <span data-chip-hint className={`block text-sm ${checked ? "text-paper/80" : "text-muted"}`}>
                  {option.hint}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
