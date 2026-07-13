import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Task, type TaskStatus } from "@/lib/queries";

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: "todo", label: "Ej startad", accent: "var(--sunset-coral, #f94144)" },
  { key: "doing", label: "Pågår", accent: "var(--sunset-amber, #f8961e)" },
  { key: "done", label: "Klar", accent: "var(--sunset-violet, #43aa8b)" },
];

export function QuickStatusDialog({
  task,
  onClose,
  onChangeStatus,
  onEdit,
  onAddSubtask,
}: {
  task: Task | null;
  onClose: () => void;
  onChangeStatus: (t: Task, s: TaskStatus) => void;
  onEdit: (t: Task) => void;
  onAddSubtask?: (t: Task) => void;
}) {
  if (!task) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs glass rounded-2xl border-white/5">
        <DialogHeader>
          <DialogTitle className="font-display text-base">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {task.description && (
            <div className="text-xs text-muted-foreground bg-white/5 border border-white/5 rounded-lg p-2.5 whitespace-pre-wrap max-h-[120px] overflow-y-auto">
              {task.description}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Ändra status</p>
          <div className="grid grid-cols-3 gap-2">
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                onClick={() => onChangeStatus(task, col.key)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-xs font-medium transition-all cursor-pointer",
                  task.status === col.key && !task.pending_review
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 hover:border-primary/40 hover:bg-white/5",
                )}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full mb-1"
                  style={{ background: col.accent }}
                />
                <br />
                {col.label}
              </button>
            ))}
          </div>
          {task.pending_review && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400 text-center">
              Väntar på bedömning
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          {task.parent_id === null && (
            <Button
              variant="outline"
              className="w-full gap-1.5 rounded-xl cursor-pointer"
              onClick={() => onAddSubtask?.(task)}
            >
              <Plus className="h-3.5 w-3.5" /> Skapa underuppgift
            </Button>
          )}
          <Button variant="outline" className="w-full gap-1.5 rounded-xl cursor-pointer" onClick={() => onEdit(task)}>
            <Pencil className="h-3.5 w-3.5" /> Redigera uppgift
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
