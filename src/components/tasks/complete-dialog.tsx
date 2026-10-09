import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock } from "lucide-react";
import { TYPE_LABELS, TYPE_COLORS, type Task } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function CompleteDialog({
  task,
  onClose,
  onPending,
  onDone,
}: {
  task: Task | null;
  onClose: () => void;
  onPending: (t: Task) => void;
  onDone: (t: Task, grade: string, points: string) => void;
}) {
  const [grade, setGrade] = useState("");
  const [points, setPoints] = useState("");

  useEffect(() => {
    setGrade(task?.grade ?? "");
    setPoints(task?.points ?? "");
  }, [task]);

  if (!task) return null;

  const noGrade = task.task_type === "annat" || task.task_type === "modul";

  const handleDone = () => {
    onDone(task, grade, points);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[380px] p-4 sm:p-5 gap-3.5 glass rounded-2xl border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 text-left pr-6">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border border-white/10",
                TYPE_COLORS[task.task_type],
              )}
            >
              {TYPE_LABELS[task.task_type]}
            </span>
            {task.pending_review && (
              <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                Väntar
              </span>
            )}
          </div>
          <DialogTitle className="font-display text-base font-semibold leading-tight line-clamp-2">
            {task.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Markera uppgift som klar eller sätt betyg och poäng
          </DialogDescription>
        </DialogHeader>

        {noGrade ? (
          <p className="text-xs text-muted-foreground bg-white/[0.02] border border-white/5 rounded-lg p-2.5 leading-relaxed">
            Denna uppgift markeras som klar direkt utan betyg.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="complete-grade" className="text-xs font-medium text-muted-foreground">
                  Betyg
                </Label>
                <Input
                  id="complete-grade"
                  autoFocus
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="A / 5 / G"
                  className="rounded-lg h-9 bg-background/50 border-white/10 text-xs px-2.5 focus-visible:ring-1"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="complete-points" className="text-xs font-medium text-muted-foreground">
                  Poäng / Resultat
                </Label>
                <Input
                  id="complete-points"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="t.ex. 18/20"
                  className="rounded-lg h-9 bg-background/50 border-white/10 text-xs px-2.5 focus-visible:ring-1"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              Tips: Lämna tomt eller använd <code className="text-[10px]">-</code> om det inte är tillämpligt.
            </p>
          </div>
        )}

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

          {!noGrade && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPending(task)}
              className="h-8 px-2.5 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 cursor-pointer rounded-lg shrink-0"
            >
              <Clock className="mr-1 h-3 w-3" />
              Väntar
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleDone}
            className="h-8 px-3 text-xs gradient-sunset text-white hover:opacity-90 font-medium cursor-pointer rounded-lg shrink-0 shadow-sm"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Klar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
