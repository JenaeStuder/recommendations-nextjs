import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast, over } from "@/lib/contrast";

/**
 * Guards the project's accessibility promise (WCAG AAA) against the REAL stylesheet: these tests read
 * the colours out of globals.css, so changing a token there that breaks contrast fails the build.
 * Text needs 7:1. Anything a person operates (borders of chips, inputs, toggles) needs 3:1.
 */
const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

type Tokens = Record<string, string>;

/** Reads `--name: #hex;` pairs out of one CSS block. */
const tokensIn = (block: string): Tokens =>
  Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2].toLowerCase()]));

const lightBlock = css.match(/:root\s*{([^}]*)}/)![1];
// Dark has two selectors (chosen in the toggle, or the system preference with no choice made).
const darkChosenBlock = css.match(/:root\[data-theme="dark"\]\s*{([^}]*)}/)![1];
const darkSystemBlock = css.match(/prefers-color-scheme:\s*dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{([^}]*)}/)![1];
const darkBlock = darkChosenBlock;

/** Opacity of the hover wash for each theme, read from `--hover-bg: color-mix(... ink NN% ...)`. */
const washOf = (block: string) => Number(block.match(/--hover-bg:[^;]*?(\d+)%/)![1]) / 100;

const themes: Record<string, { t: Tokens; wash: number }> = {
  light: { t: tokensIn(lightBlock), wash: washOf(lightBlock) },
  dark: { t: tokensIn(darkBlock), wash: washOf(darkBlock) },
};

describe.each(Object.entries(themes))("%s theme", (_name, { t, wash }) => {
  it("defines every token", () => {
    for (const k of ["paper", "surface", "ink", "muted", "line", "edge", "accent"]) expect(t[k], k).toBeDefined();
  });

  it.each(["paper", "surface"])("keeps ink, muted and accent text at AAA (7:1) on %s", (bg) => {
    for (const fg of ["ink", "muted", "accent"]) {
      expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(7);
    }
  });

  it("keeps the label on a filled button (paper on ink, paper on accent) at AAA", () => {
    expect(contrast(t.paper, t.ink)).toBeGreaterThanOrEqual(7);
    expect(contrast(t.paper, t.accent)).toBeGreaterThanOrEqual(7);
    expect(contrast(t.surface, t.accent)).toBeGreaterThanOrEqual(7);
  });

  it.each(["paper", "surface"])("keeps the edge of an operable control at 3:1 or more on %s (WCAG 1.4.11)", (bg) => {
    expect(contrast(t.edge, t[bg])).toBeGreaterThanOrEqual(3);
  });

  it("keeps ink text AAA on the hover wash, over the page or a card", () => {
    expect(wash).toBeGreaterThan(0);
    for (const bg of ["paper", "surface"]) {
      expect(contrast(t.ink, over(t.ink, t[bg], wash)), `ink on hover wash over ${bg}`).toBeGreaterThanOrEqual(7);
    }
  });

  it("keeps the grey hint text from needing to stay grey on hover: it must swap to ink, because muted alone falls short", () => {
    // Documents why the hover rule recolours [data-chip-hint]: on the wash, muted is below AAA.
    const washed = over(t.ink, t.surface, wash);
    expect(contrast(t.muted, washed)).toBeLessThan(7);
    expect(contrast(t.ink, washed)).toBeGreaterThanOrEqual(7);
  });

  it("uses line only for decoration: it is allowed to be faint, but still visible against the page", () => {
    expect(contrast(t.line, t.paper)).toBeGreaterThan(1.3);
  });
});

describe("theme switching", () => {
  it("gives the chosen dark theme and the system dark theme exactly the same colours", () => {
    expect(tokensIn(darkSystemBlock)).toEqual(tokensIn(darkChosenBlock));
    expect(washOf(darkSystemBlock)).toBe(washOf(darkChosenBlock));
  });

  it("lets an explicit choice of light beat a dark system preference", () => {
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it("tells the browser which scheme is active, so scrollbars and form controls match", () => {
    expect(lightBlock).toContain("color-scheme: light");
    expect(darkChosenBlock).toContain("color-scheme: dark");
    expect(darkSystemBlock).toContain("color-scheme: dark");
  });
});

describe("hover rule", () => {
  it("recolours the hint text and skips disabled, selected and opted-out buttons", () => {
    expect(css).toContain("[data-chip-hint]");
    expect(css).toMatch(/button:hover:not\(:disabled, \[aria-pressed="true"\], \[data-no-hover\]\)/);
  });

  it("only applies where the device can really hover", () => {
    expect(css).toContain("@media (hover: hover)");
  });
});

describe("motion", () => {
  it("switches animations and transitions off for people who ask for reduced motion", () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*transition-duration/);
  });
});
