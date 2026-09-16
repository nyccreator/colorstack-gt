export const OTP_LENGTH = 6;

export const OTP_EXPIRY_SECONDS = 10 * 60;

/** Wrong entries allowed before a code stops working. */
export const OTP_ALLOWED_ATTEMPTS = 3;

/** Code requests Better Auth accepts per address in each window. */
export const OTP_RATE_LIMIT = { window: 60, max: 3 };

/** How long the code screen waits before offering to send another. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Longest answer any free-text profile field accepts. */
export const TEXT_MAX_LENGTH = 254;

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

export const RESUME_CONTENT_TYPE = "application/pdf";
