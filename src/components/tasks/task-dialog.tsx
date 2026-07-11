import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { type Task, type TaskType, type TaskKind, TYPES_ALPHA, TYPE_LABELS } from "@/lib/queries";

type CourseOption = { id: string; name: string; color: string };

const EXAM_TYPES = new Set<TaskType>([
  "inlamningsuppgift",
  "kontrollskrivning",
  "laboration",
  "quiz",
  "redovisning",
  "seminarie",
  "tenta",
  "ovning",
]);

export function TaskDialog({
  open,
  onOpenChange,
  courses,
  task,
  defaultKind,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: CourseOption[];
  task?: Task;
  defaultKind?: TaskKind;
  onSave: (v: Partial<Task>) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueAt, setDueAt] = useState(task?.due_at ? task.due_at.slice(0, 16) : "");
  const [courseId, setCourseId] = useState(task?.course_id ?? "none");
  const [type, setType] = useState<TaskType>(task?.task_type ?? "annat");
  const kind: TaskKind = EXAM_TYPES.has(type) ? "exam" : "task";

  // Reset when task changes
  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setDueAt(task?.due_at ? task.due_at.slice(0, 16) : "");
    setCourseId(task?.course_id ?? "none");
    setType(task?.task_type ?? "annat");
  }, [task, defaultKind]);

  const submit = () => {
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      course_id: courseId === "none" ? null : courseId,
      task_type: type,
      task_kind: kind,
      ...(task ? {} : { status: "todo", pending_review: false }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg glass rounded-2xl border-white/5">
        <DialogHeader>
          <DialogTitle className="font-display">
            {task ? "Redigera" : "Ny"} {kind === "exam" ? "examination" : "uppgift"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Beskrivning</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {TYPES_ALPHA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kurs</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">Ingen kurs</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-destructive rounded-xl" onClick={onDelete}>
              <Trash2 className="mr-1 h-4 w-4" /> Ta bort
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Avbryt
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={submit}
            className="gradient-sunset text-white hover:opacity-90 rounded-xl"
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
