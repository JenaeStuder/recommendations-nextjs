export type OpenLibraryErrorKind = "rate-limit" | "network" | "http" | "parse";

/** Typed error so the UI can show friendly, specific messages. */
export class OpenLibraryError extends Error {
  readonly kind: OpenLibraryErrorKind;
  readonly status?: number;

  constructor(kind: OpenLibraryErrorKind, message: string, status?: number) {
    super(message);
    this.name = "OpenLibraryError";
    this.kind = kind;
    this.status = status;
  }
}
