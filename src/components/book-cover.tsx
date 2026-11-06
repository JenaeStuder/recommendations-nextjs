import Image from "next/image";
import { coverUrl, type Book } from "@/lib/open-library";

/** Deterministic hue from the title so the same book always gets the same fallback. */
function hueFor(title: string): number {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function BookCover({ book }: { book: Book }) {
  const src = coverUrl(book.coverId, "M");
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-line">
      {src ? (
        <Image src={src} alt={`Cover of ${book.title}`} fill sizes="120px" className="object-cover" />
      ) : (
        <div
          role="img"
          aria-label={`No cover available for ${book.title}`}
          className="flex h-full flex-col justify-between p-3 text-left"
          style={{
            backgroundColor: `hsl(${hueFor(book.title)} 35% 28%)`,
            color: "hsl(0 0% 96%)",
          }}
        >
          <span className="font-serif text-sm leading-tight">{book.title}</span>
          <span className="text-xs opacity-80">{book.authors[0]}</span>
        </div>
      )}
    </div>
  );
}
