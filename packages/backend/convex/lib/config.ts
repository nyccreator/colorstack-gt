export const MAGIC_LINK_EXPIRY_SECONDS = 15 * 60;

export const MAGIC_LINK_RATE_LIMIT = { window: 60, max: 5 };

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

export const RESUME_CONTENT_TYPE = "application/pdf";

/** How long an uploaded file waits to be claimed by a registration. */
export const RESUME_UPLOAD_TTL_MS = 30 * 60 * 1000;

/** How many uploads one sweep removes, so a backlog drains over several runs. */
export const RESUME_SWEEP_BATCH = 200;
