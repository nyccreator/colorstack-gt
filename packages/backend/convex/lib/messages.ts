import { RESUME_MAX_BYTES, TEXT_MAX_LENGTH } from "./config";

export const RESUME_LIMIT = `${RESUME_MAX_BYTES / 1024 / 1024}MB`;

export const MESSAGES = {
  firstName: "Enter your first name.",
  lastName: "Enter your last name.",
  pronouns: "Choose your pronouns.",
  writeIn: "Enter your pronouns.",
  phone: "Enter a valid phone number.",
  major: "Choose your major.",
  year: "Choose a graduation year within four years of today.",
  race: "Choose at least one answer for race and ethnicity.",
  choose: "Choose an answer.",
  term: "Choose a term.",
  gradYear: "Choose a year.",
  tooLong: `Keep each answer under ${TEXT_MAX_LENGTH} characters.`,
  noEmail: "Enter your Georgia Tech email.",
  wrongDomain: "Use your @gatech.edu email.",
  tooManyCodes: "Too many codes requested. Wait a minute and try again.",
  signIn: "Sign in to continue.",
  failed: "We couldn't save that. Check your connection and try again.",
  resumeType: "Upload a PDF.",
  resumeSize: `Keep the file under ${RESUME_LIMIT}.`,
  resumeFirst: "Finish the earlier screens first.",
  resumeBook: "Upload a resume to join the resume book.",
  uploadSignIn: "Sign in again to upload.",
  uploadFailed: "Upload failed. Try again.",
} as const;
