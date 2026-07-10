import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Task } from "@/lib/queries";

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
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Markera som klar</DialogTitle>
        </DialogHeader>
        {noGrade ? (
          <p className="text-sm text-muted-foreground">
            Uppgiften markeras som klar utan betyg eller poäng.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Fyll i betyg och poäng. Använd <code>-</code> om det inte gäller. När båda är ifyllda
              markeras uppgiften som klar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Betyg</Label>
                <Input
                  autoFocus
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="A / 5 / -"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Poäng</Label>
                <Input
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="18/20 / -"
                />
              </div>
            </div>
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
          {!noGrade && (
            <Button variant="outline" onClick={() => onPending(task)}>
              Väntar på bedömning
            </Button>
          )}
          <Button
            onClick={() => onDone(task, grade, points)}
            className="gradient-sunset text-white hover:opacity-90"
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
