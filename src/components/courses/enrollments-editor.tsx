import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ARSKURS_OPTIONS,
  COURSE_PERIODS,
  sortPeriods,
  type CoursePeriod,
} from "@/lib/course-presets";
import { Plus, Trash2 } from "lucide-react";

export type EnrollmentDraft = {
  id?: string;
  arskurs: string;
  periods: CoursePeriod[];
};

export function emptyEnrollment(): EnrollmentDraft {
  return { arskurs: "", periods: [] };
}

/** Sorterar omgångar kronologiskt (årskurs, sedan första period). */
export function sortEnrollments(rows: EnrollmentDraft[]): EnrollmentDraft[] {
  return [...rows].sort((a, b) => {
    const ak = (Number(a.arskurs) || 99) - (Number(b.arskurs) || 99);
    if (ak !== 0) return ak;
    const pa = sortPeriods(a.periods)[0];
    const pb = sortPeriods(b.periods)[0];
    return COURSE_PERIODS.indexOf(pa ?? "P5") - COURSE_PERIODS.indexOf(pb ?? "P5");
  });
}

export function EnrollmentsEditor({
  rows,
  onChange,
}: {
  rows: EnrollmentDraft[];
  onChange: (rows: EnrollmentDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<EnrollmentDraft>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-surface/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Antagningsomgångar</Label>
          <p className="text-[10px] text-muted-foreground">
            Lägg till en rad per gång du läser kursen, t.ex. P1+P2 årskurs 2.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1 rounded-lg text-xs"
          onClick={() => onChange([...rows, emptyEnrollment()])}
        >
          <Plus className="h-3.5 w-3.5" /> Lägg till
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Ingen omgång angiven – kursen räknas inte till någon period.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={r.id ?? `new-${i}`}
              className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-2.5"
            >
              <div className="flex items-center gap-2">
                <Select value={r.arskurs} onValueChange={(v) => update(i, { arskurs: v })}>
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue placeholder="Årskurs" />
                  </SelectTrigger>
                  <SelectContent>
                    {ARSKURS_OPTIONS.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        Årskurs {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground"
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  aria-label="Ta bort omgång"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COURSE_PERIODS.map((p) => {
                  const active = r.periods.includes(p);
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() =>
                        update(i, {
                          periods: active
                            ? r.periods.filter((x) => x !== p)
                            : (sortPeriods([...r.periods, p]) as CoursePeriod[]),
                        })
                      }
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/60 bg-surface/40 text-muted-foreground hover:border-border",
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
