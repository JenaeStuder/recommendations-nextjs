"use client";

import type { Flag } from "@/lib/shelf";

type Props = {
  liked: boolean;
  saved: boolean;
  /** Called with the flag and the value it should now have. */
  onToggle: (flag: Flag, value: boolean) => void;
};

const BASE =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 5 6.6 5c2 0 3.7 1.1 5.4 3 1.7-1.9 3.4-3 5.4-3 3.2 0 5.1 3 3.9 6.3-1.8 4.6-9.3 9.2-9.3 9.2z" />
    </svg>
  );
}

function Bookmark({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4.5L6 21z" />
    </svg>
  );
}

/**
 * Like and Save as two independent toggles. The labels stay the same and `aria-pressed` carries
 * the state, so screen readers say "Like, toggle button, pressed" instead of a label that changes.
 * `relative z-10` lifts them above a row's stretched click target.
 */
export function ReactionButtons({ liked, saved, onToggle }: Props) {
  return (
    <div className="relative z-10 flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={liked}
        onClick={() => onToggle("liked", !liked)}
        className={`${BASE} ${liked ? "border-accent bg-accent text-paper" : "border-line text-ink hover:border-ink"}`}
      >
        <Heart filled={liked} />
        Like
      </button>
      <button
        type="button"
        aria-pressed={saved}
        onClick={() => onToggle("saved", !saved)}
        className={`${BASE} ${saved ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
      >
        <Bookmark filled={saved} />
        Save
      </button>
    </div>
  );
}
