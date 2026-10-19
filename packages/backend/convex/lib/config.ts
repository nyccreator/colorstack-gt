export const OTP_LENGTH = 6;

export const OTP_EXPIRY_SECONDS = 10 * 60;

export const OTP_ALLOWED_ATTEMPTS = 3;

export const OTP_RATE_LIMIT = { codes: 3, perSeconds: 60 };

export const RESEND_COOLDOWN_SECONDS = 60;

export const TEXT_MAX_LENGTH = 254;

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

export const RESUME_CONTENT_TYPE = "application/pdf";

export const resumeName = (raw: string) => raw.trim().slice(0, 120) || "resume.pdf";
