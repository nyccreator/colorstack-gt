import { isEmail, normalizeEmail } from "./identity";

function records(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];
    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (csv[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = false;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field.trim());
  rows.push(row);
  return rows;
}

function emailColumn(fields: string[]): number {
  const lower = fields.map((name) => name.toLowerCase());
  const campus = lower.indexOf("campus email");
  return campus >= 0 ? campus : lower.findIndex((name) => name.includes("email"));
}

function exportDate(rows: string[][]): number | null {
  for (const fields of rows) {
    for (const field of fields) {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(field);
      if (match) return Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
    }
  }
  return null;
}

export type Roster = { exportedAt: number | null; emails: string[] };

export function parseRoster(csv: string): Roster {
  const rows = records(csv);
  const headerIndex = rows.findIndex((fields) => fields.length > 2 && emailColumn(fields) >= 0);
  if (headerIndex < 0) return { exportedAt: null, emails: [] };

  const column = emailColumn(rows[headerIndex]!);
  const emails = new Set<string>();

  for (const fields of rows.slice(headerIndex + 1)) {
    const value = fields[column] ?? "";
    if (!value || value.startsWith("(")) continue;
    const email = normalizeEmail(value);
    if (isEmail(email)) emails.add(email);
  }

  return { exportedAt: exportDate(rows.slice(0, headerIndex)), emails: [...emails] };
}
