import { mergeRanges, type Audience, type Range } from "@/lib/open-library";

export type Option = {
  id: string;
  label: string;
  /** Short helper text shown under single-choice options. */
  hint?: string;
  /** Open Library subject strings this option should match (OR). Messy upstream, so curated. */
  subjects?: string[];
};

export type QuestionId = "genres" | "audience" | "moods" | "length" | "era" | "popularity";

export type Question = {
  id: QuestionId;
  title: string;
  description: string;
  kind: "multi" | "single";
  /** Max selections for multi-choice questions. */
  max?: number;
  required?: boolean;
  options: Option[];
};

export const QUESTIONS: Question[] = [
  {
    id: "genres",
    title: "What do you feel like reading?",
    description: "Pick up to three genres, choose at least one to continue.",
    kind: "multi",
    max: 3,
    required: true,
    options: [
      { id: "fantasy", label: "Fantasy", subjects: ["fantasy"] },
      { id: "scifi", label: "Science fiction", subjects: ["science fiction"] },
      { id: "mystery", label: "Mystery", subjects: ["mystery", "detective and mystery stories"] },
      { id: "thriller", label: "Thriller", subjects: ["thriller", "suspense"] },
      { id: "romance", label: "Romance", subjects: ["romance", "love stories"] },
      { id: "horror", label: "Horror", subjects: ["horror", "horror fiction"] },
      { id: "historical", label: "Historical fiction", subjects: ["historical fiction"] },
      { id: "biography", label: "Biography", subjects: ["biography"] },
      { id: "memoir", label: "Memoir", subjects: ["memoir"] },
      { id: "selfhelp", label: "Self-help", subjects: ["self-help"] },
    ],
  },
  {
    id: "audience",
    title: "Who's it for?",
    description:
      "Leave blank to see everything. Open Library has no official age ratings, so this goes by its subject tags and can miss the odd book.",
    kind: "multi",
    options: [
      { id: "children", label: "Children", hint: "Picture books and middle grade" },
      { id: "teen", label: "Teens & young adult", hint: "Includes new adult" },
      { id: "adult", label: "Adults", hint: "No children's or young adult tags" },
    ],
  },
  {
    id: "moods",
    title: "What's the mood?",
    description: "Pick up to three, or skip to see everything.",
    kind: "multi",
    max: 3,
    options: [
      { id: "cozy", label: "Cozy", subjects: ["cozy", "cozy mystery", "friendship", "heartwarming"] },
      { id: "dark", label: "Dark", subjects: ["dark", "gothic", "dark fantasy", "murder"] },
      { id: "epic", label: "Epic", subjects: ["epic", "epic fantasy", "war", "adventure"] },
      { id: "funny", label: "Funny", subjects: ["humor", "humorous fiction", "comedy", "satire"] },
      { id: "emotional", label: "Emotional", subjects: ["emotional", "grief", "family", "love"] },
      { id: "twisty", label: "Twisty", subjects: ["psychological", "suspense", "conspiracy"] },
    ],
  },
  {
    id: "length",
    title: "How long a read?",
    description: "Pick any that suit you. Page counts are medians across editions, so treat them as a guide.",
    kind: "multi",
    options: [
      { id: "quick", label: "Quick", hint: "Under 250 pages" },
      { id: "medium", label: "Medium", hint: "250 to 450 pages" },
      { id: "epic", label: "Long", hint: "450 pages or more" },
    ],
  },
  {
    id: "era",
    title: "Old or new?",
    description: "Pick any that suit you, based on first publication year.",
    kind: "multi",
    options: [
      { id: "classic", label: "Classics", hint: "Before 1970" },
      { id: "modern", label: "Modern", hint: "1970 to 2014" },
      { id: "new", label: "Recent", hint: "2015 onwards" },
    ],
  },
  {
    id: "popularity",
    title: "Crowd favourite or hidden gem?",
    description: "Hidden gems have fewer ratings, so they're a bit more of a gamble.",
    kind: "single",
    options: [
      { id: "popular", label: "Crowd favourites", hint: "Widely rated and loved" },
      { id: "hidden", label: "Hidden gems", hint: "Fewer ratings, less well known" },
      { id: "any", label: "Surprise me", hint: "Anything goes" },
    ],
  },
];

export type Step = {
  /**
   * Screen heading. Without one, the first question's title is the heading and the
   * rest sit below it as sub-questions (e.g. genres, then audience).
   */
  heading?: { title: string; description: string };
  questions: QuestionId[];
};

/**
 * The screens after the "book or author you love" screen, in order. Three screens in total keeps
 * the flow short; everything on the last one is optional, so it can be skipped straight to results.
 */
export const STEPS: Step[] = [
  { questions: ["genres", "audience"] },
  {
    heading: {
      title: "Fine-tune your picks",
      description: "All optional. Skip anything you don't mind about.",
    },
    questions: ["moods", "length", "era", "popularity"],
  },
];

export type Answers = Record<QuestionId, string[]>;

export const EMPTY_ANSWERS: Answers = {
  genres: [],
  audience: [],
  moods: [],
  length: [],
  era: [],
  popularity: [],
};

export function getQuestion(id: QuestionId): Question {
  return QUESTIONS.find((q) => q.id === id)!;
}

/** Shared by candidate search and scoring so both agree on what "medium" means. */
export const LENGTH_RANGES: Record<string, Range> = {
  quick: { max: 249 },
  medium: { min: 250, max: 450 },
  epic: { min: 451 },
};

export const ERA_RANGES: Record<string, Range> = {
  classic: { max: 1969 },
  modern: { min: 1970, max: 2014 },
  new: { min: 2015 },
};

export function audiencesOf(a: Answers): Audience[] {
  return a.audience.filter((x): x is Audience => x === "children" || x === "teen" || x === "adult");
}

const rangesFor = (table: Record<string, Range>, selected: string[]): Range[] =>
  mergeRanges(selected.flatMap((id) => (table[id] ? [table[id]] : [])));

/** Page ranges for the chosen lengths, merged (quick + medium = under 451). Empty = no preference. */
export const pagesOf = (a: Answers): Range[] => rangesFor(LENGTH_RANGES, a.length);

/** Year ranges for the chosen eras, merged. Empty = no preference. */
export const erasOf = (a: Answers): Range[] => rangesFor(ERA_RANGES, a.era);

export type Popularity = "popular" | "hidden" | "any";

export function popularityOf(a: Answers): Popularity {
  const [p] = a.popularity;
  return p === "popular" || p === "hidden" ? p : "any";
}

export function subjectsFor(id: QuestionId, selected: string[]): string[] {
  const options = getQuestion(id).options;
  return selected.flatMap((s) => options.find((o) => o.id === s)?.subjects ?? []);
}
