const LINK =
  "underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * The credit Open Library's data deserves, and a plain statement of what we keep. Both are short on
 * purpose: this is the only place a visitor learns where the books come from and where their likes live.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-6 py-5 text-sm text-muted lg:py-3">
        <p>
          Books, covers and descriptions from{" "}
          <a href="https://openlibrary.org" target="_blank" rel="noreferrer" className={LINK}>
            Open Library
          </a>
          , written by its readers. Your likes, saves and theme stay in this browser. Nothing is sent to us.
        </p>
      </div>
    </footer>
  );
}
