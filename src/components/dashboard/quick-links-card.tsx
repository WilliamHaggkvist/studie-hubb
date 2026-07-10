import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Globe,
  GraduationCap,
  BookOpen,
  Calendar as CalendarIcon,
  Link as LinkIcon,
  MessageSquare,
  Mail,
  FileText,
  Play,
  Settings,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";

export const AVAILABLE_ICONS = [
  { name: "globe", Icon: Globe, label: "Webb" },
  { name: "school", Icon: GraduationCap, label: "Skola" },
  { name: "book", Icon: BookOpen, label: "Bok" },
  { name: "calendar", Icon: CalendarIcon, label: "Kalender" },
  { name: "link", Icon: LinkIcon, label: "Länk" },
  { name: "message", Icon: MessageSquare, label: "Chatt" },
  { name: "mail", Icon: Mail, label: "Mejl" },
  { name: "file", Icon: FileText, label: "Fil" },
  { name: "video", Icon: Play, label: "Video" },
];

export function QuickLinksCard() {
  type QuickLink = { id: string; title: string; url: string; icon?: string };
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("globe");
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("studiehubb.quick_links");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setLinks(parsed);
          return;
        }
      } catch (err) {
        console.error("Error parsing saved quick links", err);
      }
    }
    const defaults: QuickLink[] = [
      { id: "1", title: "Canvas", url: "https://canvas.instructure.com", icon: "school" },
      { id: "2", title: "Ladok", url: "https://www.student.ladok.se", icon: "book" },
      { id: "3", url: "https://www.google.se", title: "Sök", icon: "globe" },
    ];
    setLinks(defaults);
    localStorage.setItem("studiehubb.quick_links", JSON.stringify(defaults));
  }, []);

  const saveLinks = (nextLinks: QuickLink[]) => {
    setLinks(nextLinks);
    localStorage.setItem("studiehubb.quick_links", JSON.stringify(nextLinks));
  };

  const addLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    let formattedUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = "https://" + formattedUrl;
    }

    const newItem: QuickLink = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      url: formattedUrl,
      icon: selectedIcon,
    };

    const next = [...links, newItem];
    saveLinks(next);
    setNewTitle("");
    setNewUrl("");
    setSelectedIcon("globe");
    setIsAdding(false);
    toast.success("Länk tillagd");
  };

  const deleteLink = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = links.filter((l) => l.id !== id);
    saveLinks(next);
    toast.success("Länk borttagen");
  };

  const renderIcon = (iconName?: string) => {
    const match = AVAILABLE_ICONS.find((i) => i.name === iconName);
    const IconComp = match ? match.Icon : Globe;
    return (
      <IconComp className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-foreground" />
    );
  };

  return (
    <Card className="glass border-white/5 shadow-lg flex flex-col h-full min-h-[220px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--c-6)]" /> Snabblänkar
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 w-7 rounded-xl p-0 hover:bg-white/5",
              isEditing && "bg-white/10 text-primary",
            )}
            onClick={() => {
              setIsEditing(!isEditing);
              setIsAdding(false);
            }}
            title="Redigera snabblänkar"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 rounded-xl p-0 hover:bg-white/5"
            onClick={() => {
              setIsAdding(!isAdding);
              setIsEditing(false);
            }}
            title="Lägg till länk"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between p-4 pt-0">
        {isAdding ? (
          <form onSubmit={addLink} className="space-y-2 mt-1">
            <div className="space-y-1">
              <Input
                placeholder="Namn (t.ex. Canvas)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-xl h-7 text-xs bg-background/50 border-white/5 px-2.5"
                required
              />
            </div>
            <div className="space-y-1">
              <Input
                placeholder="URL (t.ex. canvas.se)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="rounded-xl h-7 text-xs bg-background/50 border-white/5 px-2.5"
                required
              />
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-9 gap-1">
                {AVAILABLE_ICONS.map((i) => {
                  const Icon = i.Icon;
                  const isSelected = selectedIcon === i.name;
                  return (
                    <button
                      key={i.name}
                      type="button"
                      onClick={() => setSelectedIcon(i.name)}
                      className={cn(
                        "flex items-center justify-center p-0 rounded-lg border text-muted-foreground hover:text-foreground transition-all cursor-pointer h-6 w-6 shrink-0",
                        isSelected
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-white/5 bg-white/5",
                      )}
                      title={i.label}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-xl h-6 px-2 text-[10px] hover:bg-white/5"
                onClick={() => setIsAdding(false)}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl h-6 px-2.5 text-[10px] gradient-sunset text-white"
              >
                Spara
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {links.length === 0 && (
              <div className="col-span-2 py-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                Inga länkar tillagda ännu.
              </div>
            )}
            {links.map((link) => {
              const content = (
                <>
                  {renderIcon(link.icon)}
                  <span className="min-w-0 flex-1 truncate font-medium">{link.title}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isEditing ? (
                      <span
                        role="button"
                        className="p-0.5 text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                        onClick={(e) => deleteLink(link.id, e)}
                        title="Ta bort länk"
                      >
                        <Trash2 className="h-3 w-3" />
                      </span>
                    ) : (
                      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                    )}
                  </div>
                </>
              );

              if (isEditing) {
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/5 px-2 py-1 text-[11px] h-7"
                  >
                    {content}
                  </div>
                );
              }

              return (
                <a
                  key={link.id}
                  href={link.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10 transition-colors h-7"
                >
                  {content}
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
