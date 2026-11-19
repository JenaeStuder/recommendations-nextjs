"use client";

import { useEffect } from "react";
import { ACTION, ACTION_PRIMARY, StatusPage } from "@/components/status-page";

/**
 * Shown if something throws while the page is drawing. (Failed Open Library requests are handled
 * where they happen, with their own messages; this is for the unexpected.) `retry` is this Next
 * version's way to re-fetch and re-render; the older `reset` is not what we want here.
 */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      title="Something went wrong"
      actions={
        <>
          <button type="button" onClick={() => retry()} className={ACTION_PRIMARY}>
            Try again
          </button>
          {/*
            A full page load, not a link: the crash happened at this very address, so a client-side
            navigation to "/" keeps the error screen showing. Reloading the current path (which already
            includes the site's base path on GitHub Pages) drops any ?query and starts clean.
          */}
          <button type="button" onClick={() => window.location.assign(window.location.pathname)} className={ACTION}>
            Start over
          </button>
        </>
      }
    >
      <p>The page hit a problem it couldn&apos;t recover from. Your likes and saves are kept on this device.</p>
      <p>Try again, and if it keeps happening, start over from the first question.</p>
    </StatusPage>
  );
}
