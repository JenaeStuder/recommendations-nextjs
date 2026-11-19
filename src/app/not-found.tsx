import Link from "next/link";
import { ACTION_PRIMARY, StatusPage } from "@/components/status-page";

export default function NotFound() {
  return (
    <StatusPage
      title="That page isn't on the shelf"
      actions={
        <Link href="/" className={ACTION_PRIMARY}>
          Find a book
        </Link>
      }
    >
      <p>The address may have a typo, or the page may have moved.</p>
    </StatusPage>
  );
}
