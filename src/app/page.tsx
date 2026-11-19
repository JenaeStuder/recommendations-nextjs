import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { SITE_NAME } from "@/lib/site";

/**
 * What is in the static HTML before the app's JavaScript runs (and for anyone without it): the same
 * header and main landmarks as the real app, so nothing jumps when it takes over.
 */
function Loading() {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:mb-5">
        <h1 className="font-serif text-lg whitespace-nowrap text-muted">{SITE_NAME}</h1>
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        <p className="text-muted">Loading…</p>
        <noscript>
          <p>{SITE_NAME} needs JavaScript to find your books. Please turn it on and reload the page.</p>
        </noscript>
      </main>
    </>
  );
}

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-14 lg:py-6">
      {/* useSearchParams (for shared links) needs a Suspense boundary in a static export. */}
      <Suspense fallback={<Loading />}>
        <AppShell />
      </Suspense>
    </div>
  );
}
