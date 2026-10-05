import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Kontrollerar om ett värde (t.ex. betyg eller poäng) faktiskt har skrivits in,
 * dvs inte är tomt, null, undefined eller en bindestreck-platshållare ("-", "–", "—").
 */
export function hasEnteredValue(val: string | null | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "–" ||
    trimmed === "—" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return false;
  }
  return true;
}
