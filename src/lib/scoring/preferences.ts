import {
  erasOf,
  getQuestion,
  pagesOf,
  popularityOf,
  type Answers,
  type QuestionId,
} from "@/lib/questions";
import type { Book } from "@/lib/open-library";
import { authorProfileTokens, subjectTokens, type Taste } from "@/lib/taste";
import type { Preferences, Signal } from "./types";

function signalsFor(id: QuestionId, kind: Signal["kind"], selected: string[]): Signal[] {
  const options = getQuestion(id).options;
  return selected.flatMap((sel) => {
    const o = options.find((x) => x.id === sel);
    return o?.subjects ? [{ id: o.id, label: o.label, kind, subjects: o.subjects }] : [];
  });
}

/**
 * `candidates` lets an author-only taste ("books like Sanderson's") be turned into a profile
 * of what they write about, using their books among the candidates.
 */
function similarTarget(taste: Taste, candidates: Book[]): Preferences["similarTo"] {
  if (taste.book) {
    return { id: taste.book.id, title: taste.book.title, tokens: subjectTokens(taste.book.subjects) };
  }
  if (taste.author) {
    const tokens = authorProfileTokens(candidates, taste.author.id);
    if (tokens.length > 0) return { id: "", title: `${taste.author.name}'s books`, tokens };
  }
  return undefined;
}

export function toPreferences(a: Answers, taste: Taste = {}, candidates: Book[] = []): Preferences {
  return {
    signals: [...signalsFor("genres", "genre", a.genres), ...signalsFor("moods", "mood", a.moods)],
    pages: pagesOf(a),
    years: erasOf(a),
    popularity: popularityOf(a),
    similarTo: similarTarget(taste, candidates),
    favouriteAuthor: taste.author,
  };
}
