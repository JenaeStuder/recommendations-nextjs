import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, THEME_KEY, THEME_LABEL, THEME_ORDER, applyTheme, nextTheme, parseTheme } from "./theme";

describe("parseTheme", () => {
  it("accepts the two explicit choices", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("treats anything else as 'follow the system', so bad stored data can never break the page", () => {
    for (const bad of [null, undefined, "", "system", "DARK", "blue", 1, {}, ["dark"], "<script>"]) {
      expect(parseTheme(bad)).toBe("system");
    }
  });
});

describe("nextTheme", () => {
  it("cycles auto, light, dark, and back to auto", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });

  it("visits every theme exactly once in a full loop", () => {
    const seen = new Set<string>();
    let t = THEME_ORDER[0];
    for (let i = 0; i < THEME_ORDER.length; i++) {
      seen.add(t);
      t = nextTheme(t);
    }
    expect(seen.size).toBe(THEME_ORDER.length);
    expect(t).toBe(THEME_ORDER[0]);
  });

  it("has a visible label for every theme", () => {
    for (const t of THEME_ORDER) expect(THEME_LABEL[t].length).toBeGreaterThan(0);
  });
});

describe("applyTheme", () => {
  const root = () => ({ dataset: {} as Record<string, string | undefined> }) as unknown as HTMLElement;

  it("sets data-theme for an explicit choice", () => {
    const el = root();
    applyTheme("dark", el);
    expect(el.dataset.theme).toBe("dark");
    applyTheme("light", el);
    expect(el.dataset.theme).toBe("light");
  });

  it("removes data-theme for 'system', so the OS preference decides again", () => {
    const el = root();
    applyTheme("dark", el);
    applyTheme("system", el);
    expect("theme" in el.dataset).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  // Runs the real script against a fake page, the way the browser would before first paint.
  const run = (stored: string | null | "throws") => {
    const root = { dataset: {} as Record<string, string> };
    const localStorage = {
      getItem: (k: string) => {
        if (stored === "throws") throw new Error("blocked");
        return k === THEME_KEY ? stored : null;
      },
    };
    new Function("localStorage", "document", THEME_INIT_SCRIPT)(localStorage, { documentElement: root });
    return root.dataset.theme;
  };

  it("applies a stored light or dark choice", () => {
    expect(run("dark")).toBe("dark");
    expect(run("light")).toBe("light");
  });

  it("does nothing when nothing, or something unexpected, is stored", () => {
    expect(run(null)).toBeUndefined();
    expect(run("system")).toBeUndefined();
    expect(run("<img onerror=alert(1)>")).toBeUndefined();
  });

  it("does not throw when storage is blocked (private windows, cookies disabled)", () => {
    expect(() => run("throws")).not.toThrow();
    expect(run("throws")).toBeUndefined();
  });
});
