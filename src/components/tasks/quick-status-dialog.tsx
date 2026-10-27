import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_LABELS, TYPE_COLORS, type Task, type TaskStatus } from "@/lib/queries";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

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

  const due = task.due_at ? new Date(task.due_at) : null;
  const validDue = due && !isNaN(due.getTime());

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-[92vw] sm:w-full p-5 sm:p-6 glass rounded-2xl border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left pr-8 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border border-white/10",
                TYPE_COLORS[task.task_type],
              )}
            >
              {TYPE_LABELS[task.task_type]}
            </span>
            {validDue && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{format(due, "yyyy-MM-dd HH:mm", { locale: sv })}</span>
              </span>
            )}
            {task.pending_review && (
              <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                Väntar på bedömning
              </span>
            )}
          </div>
          <DialogTitle className="font-display text-base sm:text-lg font-semibold leading-snug break-words">
            {task.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Hantera status och detaljer för uppgiften
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {task.description && (
            <div className="text-xs text-muted-foreground bg-white/[0.03] border border-white/10 rounded-xl p-3 whitespace-pre-wrap break-words overflow-x-hidden max-h-[160px] overflow-y-auto leading-relaxed">
              {task.description}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Ändra status</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {COLUMNS.map((col) => {
                const isActive = task.status === col.key && !task.pending_review;
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => onChangeStatus(task, col.key)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 sm:py-3 text-xs font-medium transition-all cursor-pointer",
                      isActive
                        ? "border-primary bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40 font-semibold"
                        : "border-border/60 hover:border-primary/40 hover:bg-white/5 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0 transition-transform",
                        isActive && "scale-125"
                      )}
                      style={{ background: col.accent }}
                    />
                    <span>{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
          {task.parent_id === null && onAddSubtask && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 rounded-xl text-xs h-9 cursor-pointer border-white/10 hover:bg-white/5 hover:border-white/20"
              onClick={() => onAddSubtask(task)}
            >
              <Plus className="h-3.5 w-3.5" /> Skapa underuppgift
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 rounded-xl text-xs h-9 cursor-pointer border-white/10 hover:bg-white/5 hover:border-white/20"
            onClick={() => onEdit(task)}
          >
            <Pencil className="h-3.5 w-3.5" /> Redigera uppgift
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
