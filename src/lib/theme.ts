/**
 * The colour theme: follow the system (the default), or the person's explicit choice of light or
 * dark. The choice is the one thing we store about them besides likes and saves, in localStorage.
 */
export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "theme";

/** The toggle cycles through these in order. */
export const THEME_ORDER: readonly Theme[] = ["system", "light", "dark"];

export const THEME_LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };

/** Anything stored that isn't exactly a known choice (missing, edited, from an older version) means "system". */
export function parseTheme(raw: unknown): Theme {
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function nextTheme(current: Theme): Theme {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
}

/**
 * Runs in <head> before the page paints, so a person who chose dark never sees a flash of light.
 * Kept as a plain string because it must run before React. It only ever sets the two known values.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Puts the theme on <html>: "system" removes the attribute so the OS preference decides. */
export function applyTheme(theme: Theme, root: Pick<HTMLElement, "dataset"> = document.documentElement): void {
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}
