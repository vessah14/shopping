export type StoreComment = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

export type NewStoreComment = {
  name: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseNewStoreComment(value: unknown): NewStoreComment | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.message !== "string") {
    return null;
  }

  const name = value.name.trim();
  const message = value.message.trim();
  if (name.length < 2 || name.length > 80 || message.length < 2 || message.length > 1000) {
    return null;
  }

  return { name, message };
}

export function isStoreComment(value: unknown): value is StoreComment {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string" &&
    !Number.isNaN(Date.parse(value.createdAt));
}
