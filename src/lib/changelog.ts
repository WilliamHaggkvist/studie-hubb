/** Nyheter i appen. Lägg nya poster överst – de visas som notis tills de läses/avfärdas. */
export type ChangelogEntry = { id: string; date: string; title: string; body?: string };

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-10-05-fler-notiser",
    date: "2026-10-05",
    title: "Fler notiser i inkorgen",
    body: "HP-milstolpar, veckomål, CSN-varning, tomma kurser och mer.",
  },
];
