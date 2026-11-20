import path from "node:path";

/** Directory where product images uploaded from the admin are stored (a Railway volume in production). */
export const uploadsDirectory = path.join(process.cwd(), "public", "uploads", "products");

export const uploadFilenamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
