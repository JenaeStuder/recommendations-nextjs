import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-20">
      {/* useSearchParams (for shared links) needs a Suspense boundary in a static export. */}
      <Suspense>
        <AppShell />
      </Suspense>
    </main>
  );
}
