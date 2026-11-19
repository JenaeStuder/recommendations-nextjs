import type { ReactNode } from "react";

/**
 * A full-page message with something to do next, used for "something broke" and "no such page". It
 * provides its own <main> because the app's header and main (in AppShell) aren't on these screens.
 */
export function StatusPage({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center outline-none"
    >
      <h1 className="font-serif text-3xl leading-tight">{title}</h1>
      <div className="mt-3 space-y-2 text-muted">{children}</div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
    </main>
  );
}

export const ACTION =
  "cursor-pointer rounded-full border border-ink px-6 py-2.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
export const ACTION_PRIMARY = `${ACTION} bg-ink text-paper`;
