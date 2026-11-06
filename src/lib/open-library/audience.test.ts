import { describe, expect, it } from "vitest";
import { audienceClause } from "./audience";
import { buildQuery } from "./client";

const has = (clause: string | undefined, text: string) => (clause ?? "").includes(text);

describe("audienceClause", () => {
  it("means 'no filter' for none or all three", () => {
    expect(audienceClause([])).toBeUndefined();
    expect(audienceClause(["children", "teen", "adult"])).toBeUndefined();
  });

  it("ignores duplicates", () => {
    expect(audienceClause(["teen", "teen"])).toBe(audienceClause(["teen"]));
    expect(audienceClause(["children", "teen", "adult", "adult"])).toBeUndefined();
  });

  it("children = children's tags but NOT young-adult tags (YA books carry both)", () => {
    const c = audienceClause(["children"]);
    expect(has(c, 'subject:"juvenile fiction"')).toBe(true);
    expect(has(c, "AND NOT")).toBe(true);
    expect(has(c, 'subject:"young adult fiction"')).toBe(true);
  });

  it("doesn't trust a bare \"children's fiction\" tag, which is often stray on adult books", () => {
    for (const a of [["children"], ["adult"], ["children", "teen"]] as const) {
      expect(audienceClause([...a])).not.toContain("children's");
    }
  });

  it("teen = young-adult tags only, including new adult", () => {
    const t = audienceClause(["teen"]);
    expect(has(t, 'subject:"young adult fiction"')).toBe(true);
    expect(has(t, 'subject:"new adult"')).toBe(true);
    expect(has(t, "juvenile")).toBe(false);
    expect(has(t, "NOT")).toBe(false);
  });

  it("adult = neither (adult books mostly have no audience tag), using '-' exclusions", () => {
    const a = audienceClause(["adult"])!;
    expect(a.startsWith("-(")).toBe(true);
    expect(has(a, 'subject:"juvenile fiction"')).toBe(true);
    expect(has(a, 'subject:"young adult fiction"')).toBe(true);
    // `(*:* AND NOT x)` is rejected by Open Library's search, so it must never be used.
    expect(a).not.toContain("*:*");
  });

  it("builds the verified set-logic formula for every combination", () => {
    // Each of these was checked against the live API (their counts add up to the whole catalogue).
    expect(audienceClause(["children", "teen"])).toMatch(/^\(\(.*\) OR \(.*\)\)$/); // C or T
    expect(audienceClause(["children", "adult"])!.startsWith("-(")).toBe(true); // not T
    expect(audienceClause(["children", "adult"])).not.toContain("juvenile"); // ...and says nothing about C
    expect(audienceClause(["teen", "adult"])).toMatch(/^-\(\(.*\) AND NOT \(.*\)\)$/); // not (C and not T)
  });

  it("gives every combination a different clause", () => {
    const combos = [["children"], ["teen"], ["adult"], ["children", "teen"], ["children", "adult"], ["teen", "adult"]] as const;
    const clauses = combos.map((c) => audienceClause([...c]));
    expect(new Set(clauses).size).toBe(6);
  });
});

describe("buildQuery with audiences", () => {
  it("combines the audience clause with the other filters", () => {
    const q = buildQuery({ subjectGroups: [["fantasy"]], audiences: ["adult"] });
    expect(q.startsWith('subject:"fantasy" -(')).toBe(true);
  });
  it("adds nothing when no audience is chosen", () => {
    expect(buildQuery({ subjectGroups: [["fantasy"]], audiences: [] })).toBe('subject:"fantasy"');
  });
});
