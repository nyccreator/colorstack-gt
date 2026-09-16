import { isEmail, normalizeEmail } from "./identity";

function splitRow(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (line[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = false;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }

  fields.push(field);
  return fields.map((value) => value.trim());
}

function emailColumn(fields: string[]): number {
  const lower = fields.map((name) => name.toLowerCase());
  const campus = lower.indexOf("campus email");
  return campus >= 0 ? campus : lower.findIndex((name) => name.includes("email"));
}

function exportDate(lines: string[]): number | null {
  for (const line of lines) {
    for (const field of splitRow(line)) {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(field);
      if (match) return Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
    }
  }
  return null;
}

export type Roster = { exportedAt: number | null; emails: string[] };

export function parseRoster(csv: string): Roster {
  const lines = csv.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const fields = splitRow(line);
    return fields.length > 2 && emailColumn(fields) >= 0;
  });
  if (headerIndex < 0) return { exportedAt: null, emails: [] };

  const column = emailColumn(splitRow(lines[headerIndex]!));
  const emails = new Set<string>();

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const value = splitRow(line)[column] ?? "";
    if (!value || value.startsWith("(")) continue;
    const email = normalizeEmail(value);
    if (isEmail(email)) emails.add(email);
  }

  return { exportedAt: exportDate(lines.slice(0, headerIndex)), emails: [...emails] };
}
