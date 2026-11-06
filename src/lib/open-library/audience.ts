/**
 * Open Library has no age-rating field. The closest thing is subject tags that
 * cataloguers add inconsistently, so everything here is a heuristic:
 *
 * - Young adult books usually carry BOTH a young-adult tag and the children's tags
 *   ("juvenile fiction"), so "children" has to mean children's tags WITHOUT young-adult ones.
 * - Adult books mostly carry no audience tag at all, so "adult" means "has neither".
 * - "New adult" is tagged on too few books to stand alone, so it's folded into teen.
 *
 * The three groups partition the catalogue (checked live for fantasy: children + teen + adult = the whole set).
 */
export type Audience = "children" | "teen" | "adult";

/**
 * Deliberately NOT "children's fiction" or "children's stories": those are often stray tags on
 * adult books (checked live: The Martian, The Hero of Ages), while real children's books
 * (Matilda, Charlotte's Web, Where the Wild Things Are) also carry a "juvenile" or "picture books" tag.
 * Dropping them lost 38 of 360 fantasy books and removed the adult epics.
 */
const CHILDREN_TAGS = ["juvenile fiction", "juvenile literature", "juvenile works", "picture books"];
const TEEN_TAGS = ["young adult fiction", "young adult", "teen", "new adult"];

const anyOf = (tags: string[]) => `(${tags.map((t) => `subject:"${t}"`).join(" OR ")})`;

/**
 * Solr clause for the chosen audiences, or undefined for "no filter" (none or all three).
 * Written as set logic over C = children's tags and T = teen tags:
 *   children = C and not T      teen = T      adult = not C and not T
 * Combinations are unions of those. A clause starting with "-" only excludes, so it must be
 * combined with at least one positive clause (every search we build has one).
 * Note `(*:* AND NOT x)` is NOT valid here, so exclusions use the `-` prefix.
 */
export function audienceClause(audiences: Audience[]): string | undefined {
  const picked = new Set(audiences);
  const c = picked.has("children");
  const t = picked.has("teen");
  const a = picked.has("adult");
  const C = anyOf(CHILDREN_TAGS);
  const T = anyOf(TEEN_TAGS);

  if (c === t && t === a) return undefined; // none or all
  if (c && t) return `(${C} OR ${T})`; // not adult only
  if (c && a) return `-${T}`; // everything except teen
  if (t && a) return `-(${C} AND NOT ${T})`; // everything except children-only
  if (c) return `(${C} AND NOT ${T})`;
  if (t) return T;
  return `-${C} -${T}`; // adult
}
