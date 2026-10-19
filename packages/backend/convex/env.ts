const siteUrl = process.env.SITE_URL;
if (!siteUrl) throw new Error("SITE_URL is not set on this deployment.");

export const SITE_URL = siteUrl;
