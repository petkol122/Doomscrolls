import type { IsoDateTimeString } from "@doomscrolls/shared";

export function toIsoDateTimeString(date: Date): IsoDateTimeString {
  return date.toISOString() as IsoDateTimeString;
}

export function requireString(value: string | null | undefined, fieldName: string): string {
  if (value === null || value === undefined || value.length === 0) {
    throw new Error(`Cannot map missing required field: ${fieldName}`);
  }

  return value;
}