import Image from "next/image";
import { CLOTH_TEXT, clothFor } from "@/lib/cover-cloth";
import { coverUrl, type Book } from "@/lib/open-library";

export function BookCover({ book }: { book: Book }) {
  const src = coverUrl(book.coverId, "M");
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-line">
      {src ? (
        <Image src={src} alt={`Cover of ${book.title}`} fill sizes="120px" draggable={false} className="object-cover" />
      ) : (
        <div
          role="img"
          aria-label={`No cover available for ${book.title}`}
          className="flex h-full flex-col justify-between p-3 text-left"
          style={{
            backgroundColor: clothFor(book.title),
            color: CLOTH_TEXT,
          }}
        >
          <span className="font-serif text-sm leading-tight">{book.title}</span>
          <span className="text-xs opacity-90">{book.authors[0]}</span>
        </div>
      )}
    </div>
  );
}
