const fallbackSiteUrl = "https://frontend-production-d5895ab3.up.railway.app";

export const siteUrl = new URL(process.env.NEXT_PUBLIC_FRONTEND_URL || fallbackSiteUrl);

export function absoluteSiteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}