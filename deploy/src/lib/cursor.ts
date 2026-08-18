export type PaginationCursor = {
  created_at: string;
  id: string;
};

export function encodeCursor(cursor: PaginationCursor): string {
  return Buffer.from(
    JSON.stringify(cursor)
  ).toString("base64url");
}

export function decodeCursor(
  cursor: string
): PaginationCursor | null {
  try {
    const decoded = Buffer.from(
      cursor,
      "base64url"
    ).toString("utf8");

    const parsed = JSON.parse(decoded);

    if (
      typeof parsed.created_at !== "string" ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }

    return {
      created_at: parsed.created_at,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}