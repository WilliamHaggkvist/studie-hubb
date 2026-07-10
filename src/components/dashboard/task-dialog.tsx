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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Task, type TaskType, TYPE_LABELS, TYPES_ALPHA } from "@/lib/queries";

type TaskKind = "task" | "exam";
type Course = { id: string; name: string; color: string };

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
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: Course[];
  onSave: (v: Partial<Task>) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [courseId, setCourseId] = useState("none");
  const [type, setType] = useState<TaskType>("annat");
  const kind: TaskKind = EXAM_TYPES.has(type) ? "exam" : "task";

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setDueAt("");
      setCourseId("none");
      setType("annat");
    }
  }, [open]);

  const submit = () => {
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      course_id: courseId === "none" ? null : courseId,
      task_type: type,
      task_kind: kind,
      status: "todo",
      pending_review: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            Ny {kind === "exam" ? "examination" : "uppgift"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Beskrivning</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kurs</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={submit}
            className="gradient-sunset text-white hover:opacity-90"
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
