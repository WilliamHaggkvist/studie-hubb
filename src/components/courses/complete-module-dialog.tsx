import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { type ReportingModule } from "@/lib/queries";
import { formatDateYYYYMMDD, parseDateInputToISO } from "@/lib/date-utils";
import { DatePicker } from "@/components/ui/date-picker";

export function CompleteModuleDialog({
  module,
  onClose,
  onDone,
}: {
  module: ReportingModule | null;
  onClose: () => void;
  onDone: (m: ReportingModule, grade: string, points: string, registeredOn: string) => void;
}) {
  const [grade, setGrade] = useState("");
  const [points, setPoints] = useState("");
  const [registeredOn, setRegisteredOn] = useState("");

  useEffect(() => {
    setGrade(module?.grade ?? "");
    setPoints(module?.points ?? "");
    setRegisteredOn(
      module?.registered_on
        ? formatDateYYYYMMDD(module.registered_on)
        : formatDateYYYYMMDD(new Date())
    );
  }, [module]);

  if (!module) return null;

  const handleSave = () => {
    const parsedIso = parseDateInputToISO(registeredOn) ?? registeredOn;
    onDone(module, grade, points, parsedIso);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[380px] p-4 sm:p-5 gap-3.5 glass rounded-2xl border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 text-left pr-6">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-surface-2 border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
              {module.hp} HP
            </span>
          </div>
          <DialogTitle className="font-display text-base font-semibold leading-tight line-clamp-2">
            {module.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Klarmarkera rapporteringsmoment med betyg, poäng och datum
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="module-grade" className="text-xs font-medium text-muted-foreground">
                Betyg
              </Label>
              <Input
                id="module-grade"
                autoFocus
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="A / 5 / G"
                className="rounded-lg h-9 bg-background/50 border-white/10 text-xs px-2.5 focus-visible:ring-1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="module-points" className="text-xs font-medium text-muted-foreground">
                Poäng / Resultat
              </Label>
              <Input
                id="module-points"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="t.ex. 18/20"
                className="rounded-lg h-9 bg-background/50 border-white/10 text-xs px-2.5 focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              Registreringsdatum
            </Label>
            <DatePicker
              value={registeredOn}
              onChange={setRegisteredOn}
              placeholder="yyyy-mm-dd"
              className="h-9 rounded-lg bg-background/50 border-white/10 text-xs px-2.5"
            />
          </div>

          <p className="text-[10px] text-muted-foreground/80">
            Tips: Lämna tomt eller använd <code className="text-[10px]">-</code> om det inte är tillämpligt.
          </p>
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 pt-2 border-t border-white/5 sm:space-x-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
          >
            Avbryt
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="h-8 px-3 text-xs gradient-sunset text-white hover:opacity-90 font-medium cursor-pointer rounded-lg shrink-0 shadow-sm"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Spara moment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
