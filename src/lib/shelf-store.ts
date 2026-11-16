"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Book } from "@/lib/open-library";
import { sanitizeReactions, setFlag, type Flag, type Reactions } from "./shelf";

type ShelfState = {
  reactions: Reactions;
  set: (book: Book, flag: Flag, value: boolean) => void;
  clear: () => void;
};

/**
 * Likes and saves, persisted in localStorage (no backend). Only `reactions` is stored, and it is
 * re-validated on load, because a stored `Book` from an older build can have a different shape.
 */
export const useShelf = create<ShelfState>()(
  persist(
    (set) => ({
      reactions: {},
      set: (book, flag, value) => set((s) => ({ reactions: setFlag(s.reactions, book, flag, value) })),
      clear: () => set({ reactions: {} }),
    }),
    {
      name: "book-shelves",
      version: 1,
      partialize: (s) => ({ reactions: s.reactions }),
      merge: (persisted, current) => ({
        ...current,
        reactions: sanitizeReactions((persisted as { reactions?: unknown } | undefined)?.reactions),
      }),
    },
  ),
);
