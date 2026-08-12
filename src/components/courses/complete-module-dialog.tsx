import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm glass rounded-2xl border-white/5">
        <DialogHeader>
          <DialogTitle className="font-display">Klarmarkera {module.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Fyll i betyg, poäng och registreringsdatum. Använd <code>-</code> om det inte gäller.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Betyg</Label>
            <Input
              autoFocus
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="A / 5 / -"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Poäng</Label>
            <Input
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="18/20 / -"
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Registreringsdatum (yyyy-mm-dd)</Label>
          <DatePicker
            value={registeredOn}
            onChange={setRegisteredOn}
            placeholder="yyyy-mm-dd"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            className="gradient-sunset text-white hover:opacity-90 rounded-xl"
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
