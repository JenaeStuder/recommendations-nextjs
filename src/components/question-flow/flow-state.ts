import type { Author, Book } from "@/lib/open-library";
import { EMPTY_ANSWERS, getQuestion, type Answers, type QuestionId } from "@/lib/questions";
import type { Taste } from "@/lib/taste";

/** Step 0 is "a book or author you love"; steps 1..N are STEPS; then results. */
export const TASTE_STEP = 0;

export type State = { step: number; answers: Answers; taste: Taste };

export type Action =
  | { type: "toggle"; question: QuestionId; option: string }
  | { type: "book"; book: Book | undefined }
  | { type: "author"; author: Pick<Author, "id" | "name"> | undefined }
  | { type: "go"; step: number }
  /** Back to a blank first screen: clears every answer and the chosen book/author. */
  | { type: "reset" };

export const INITIAL_STATE: State = { step: TASTE_STEP, answers: EMPTY_ANSWERS, taste: {} };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "go":
      return { ...state, step: action.step };
    case "reset":
      return INITIAL_STATE;
    case "book":
      return { ...state, taste: { ...state.taste, book: action.book } };
    case "author":
      return { ...state, taste: { ...state.taste, author: action.author } };
    case "toggle": {
      const q = getQuestion(action.question);
      const current = state.answers[action.question];
      const selected = current.includes(action.option);
      let next: string[];
      if (q.kind === "single") next = selected ? [] : [action.option]; // clicking the chosen one clears it
      else if (selected) next = current.filter((id) => id !== action.option);
      else if (q.max !== undefined && current.length >= q.max) next = current; // at the cap: ignore
      else next = [...current, action.option];
      return { ...state, answers: { ...state.answers, [action.question]: next } };
    }
  }
}
