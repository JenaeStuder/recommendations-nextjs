"use client";

import { useEffect } from "react";

/**
 * The last resort: if the root layout itself fails, this replaces the whole document, so it can't
 * rely on our stylesheet, fonts or theme (the app's data-theme isn't visible here). It carries a
 * small stylesheet of its own with the same two palettes, following the system's colour scheme.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <style>{`
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; text-align: center;
            font-family: system-ui, sans-serif; background: #f5eee3; color: #2b1d22; }
          p { color: #55434a; max-width: 32rem; line-height: 1.5; }
          button { cursor: pointer; font: inherit; font-weight: 600; padding: 10px 24px; border-radius: 999px;
            border: 1px solid #2b1d22; background: #2b1d22; color: #f5eee3; }
          button:focus-visible { outline: 2px solid #2b1d22; outline-offset: 2px; }
          @media (prefers-color-scheme: dark) {
            body { background: #1c1416; color: #f3e9dc; }
            p { color: #c4b2ae; }
            button { border-color: #f3e9dc; background: #f3e9dc; color: #1c1416; }
            button:focus-visible { outline-color: #f3e9dc; }
          }
        `}</style>
        <main>
          <h1>Something went wrong</h1>
          <p>The page failed to load. Your likes and saves are kept on this device. Try again, and if it keeps happening, reload the page.</p>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
