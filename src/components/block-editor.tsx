// Simple block editor. Blocks: text, h1, h2, h3, todo, bullet, numbered, quote, divider, code
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Type, Heading1, Heading2, Heading3, ListChecks, List, ListOrdered, Quote, Minus, Code, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type Block = {
  id: string;
  type: "text" | "h1" | "h2" | "h3" | "todo" | "bullet" | "numbered" | "quote" | "divider" | "code";
  text: string;
  checked?: boolean;
};

const rid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(type: Block["type"] = "text", text = ""): Block {
  return { id: rid(), type, text };
}

const SLASH_MENU: { type: Block["type"]; label: string; icon: React.ReactNode; hint: string }[] = [
  { type: "text", label: "Text", icon: <Type className="h-4 w-4" />, hint: "Vanlig text" },
  { type: "h1", label: "Rubrik 1", icon: <Heading1 className="h-4 w-4" />, hint: "Stor rubrik" },
  { type: "h2", label: "Rubrik 2", icon: <Heading2 className="h-4 w-4" />, hint: "Mellanrubrik" },
  { type: "h3", label: "Rubrik 3", icon: <Heading3 className="h-4 w-4" />, hint: "Liten rubrik" },
  { type: "todo", label: "Att göra", icon: <ListChecks className="h-4 w-4" />, hint: "Checkbox" },
  { type: "bullet", label: "Punktlista", icon: <List className="h-4 w-4" />, hint: "• lista" },
  { type: "numbered", label: "Numrerad lista", icon: <ListOrdered className="h-4 w-4" />, hint: "1. lista" },
  { type: "quote", label: "Citat", icon: <Quote className="h-4 w-4" />, hint: "Blockcitat" },
  { type: "code", label: "Kod", icon: <Code className="h-4 w-4" />, hint: "Kodblock" },
  { type: "divider", label: "Avdelare", icon: <Minus className="h-4 w-4" />, hint: "Horisontell linje" },
];

export function BlockEditor({
  value,
  onChange,
}: {
  value: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const blocks = value.length > 0 ? value : [{ id: "fallback-block", type: "text", text: "" } as Block];
  const [focusId, setFocusId] = useState<string | null>(null);
  const [slashFor, setSlashFor] = useState<string | null>(null);

  const update = useCallback((id: string, patch: Partial<Block>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, [blocks, onChange]);

  const insertAfter = useCallback((id: string, type: Block["type"] = "text") => {
    const idx = blocks.findIndex((b) => b.id === id);
    const b = newBlock(type);
    const next = [...blocks.slice(0, idx + 1), b, ...blocks.slice(idx + 1)];
    onChange(next);
    setFocusId(b.id);
  }, [blocks, onChange]);

  const remove = useCallback((id: string) => {
    if (blocks.length <= 1) {
      onChange([newBlock()]);
      setFocusId(blocks[0].id);
      return;
    }
    const idx = blocks.findIndex((b) => b.id === id);
    
    // Om blocket innan är en avdelare, radera den först
    if (idx > 0 && blocks[idx - 1].type === "divider") {
      const dividerBlock = blocks[idx - 1];
      const next = blocks.filter((b) => b.id !== dividerBlock.id);
      onChange(next);
      setFocusId(id);
      
      toast.success("Avdelare borttagen", {
        action: {
          label: "Ångra",
          onClick: () => {
            const restored = [...next.slice(0, idx - 1), dividerBlock, ...next.slice(idx - 1)];
            onChange(restored);
          }
        }
      });
      return;
    }

    const deletedBlock = blocks[idx];
    const next = blocks.filter((b) => b.id !== id);
    onChange(next);
    const nextFocusIdx = idx > 0 ? idx - 1 : 0;
    setFocusId(next[nextFocusIdx]?.id ?? null);

    toast.success("Block borttaget", {
      action: {
        label: "Ångra",
        onClick: () => {
          const restored = [...next.slice(0, idx), deletedBlock, ...next.slice(idx)];
          onChange(restored);
        }
      }
    });
  }, [blocks, onChange]);

  const changeType = useCallback((id: string, type: Block["type"]) => {
    update(id, { type });
    setSlashFor(null);
    setFocusId(id);
  }, [update]);

  const handleWrapperClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock) {
        if (lastBlock.text !== "" || lastBlock.type === "divider") {
          insertAfter(lastBlock.id, "text");
        } else {
          if (["bullet", "numbered", "todo"].includes(lastBlock.type)) {
            update(lastBlock.id, { type: "text" });
          }
          setFocusId(lastBlock.id);
        }
      }
    }
  };

  return (
    <div 
      className="space-y-1 min-h-[300px] cursor-text pb-20" 
      onClick={handleWrapperClick}
    >
      {blocks.map((b, index) => {
        let listNumber: number | undefined = undefined;
        if (b.type === "numbered") {
          let count = 1;
          for (let i = index - 1; i >= 0; i--) {
            if (blocks[i].type === "numbered") {
              count++;
            } else {
              break;
            }
          }
          listNumber = count;
        }

        const isLast = index === blocks.length - 1;

        return (
          <BlockRow
            key={b.id}
            block={b}
            listNumber={listNumber}
            isLast={isLast}
            onArrowDownLast={() => {
              if (["bullet", "numbered", "todo"].includes(b.type) && b.text === "") {
                update(b.id, { type: "text" });
              }
            }}
            focused={focusId === b.id}
            onFocused={() => setFocusId(b.id)}
            onChange={(patch) => update(b.id, patch)}
            onEnter={() => {
              const listTypes: Block["type"][] = ["bullet", "numbered", "todo"];
              const nextType = listTypes.includes(b.type) ? b.type : "text";
              insertAfter(b.id, nextType);
            }}
            onBackspaceEmpty={() => remove(b.id)}
            onSlash={() => setSlashFor(b.id)}
            slashOpen={slashFor === b.id}
            onCloseSlash={() => setSlashFor(null)}
            onPickType={(t) => changeType(b.id, t)}
          />
        );
      })}
    </div>
  );
}

function BlockRow({
  block, focused, onFocused, onChange, onEnter, onBackspaceEmpty, onSlash,
  slashOpen, onCloseSlash, onPickType, listNumber, isLast, onArrowDownLast,
}: {
  block: Block;
  focused: boolean;
  onFocused: () => void;
  onChange: (p: Partial<Block>) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onSlash: () => void;
  slashOpen: boolean;
  onCloseSlash: () => void;
  onPickType: (t: Block["type"]) => void;
  listNumber?: number;
  isLast?: boolean;
  onArrowDownLast?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
      
      // Endast tvinga markören till slutet om det finns text.
      // För helt tomma element kan range-urval störa webbläsarens egen hantering av markören.
      if (block.text.length > 0 && ref.current.childNodes.length > 0) {
        try {
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          range.collapse(false);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch (e) {
          // Ignorera urvalsfel
        }
      }
    }
  }, [focused, block.text]);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerText !== block.text) {
      ref.current.innerText = block.text;
    }
  }, [block.text, block.type]);

  if (block.type === "divider") {
    return (
      <div className="group relative flex items-center py-2 px-1">
        <div className="w-full h-[2px] bg-gradient-to-r from-sunset-amber/60 via-sunset-coral/60 to-sunset-violet/60 rounded-full" />
      </div>
    );
  }

  const placeholder = focused ? "Skriv '/' för kommandon…" : "";

  const typographyClass = {
    text: "text-base leading-relaxed",
    h1: "font-display text-3xl font-bold tracking-tight",
    h2: "font-display text-2xl font-semibold tracking-tight",
    h3: "font-display text-xl font-semibold",
    todo: "text-base leading-relaxed",
    bullet: "text-base leading-relaxed",
    numbered: "text-base leading-relaxed",
    quote: "border-l-2 border-sunset-coral pl-3 italic text-muted-foreground",
    code: "font-mono text-sm bg-surface rounded-md px-3 py-2 border border-border/60",
    divider: "",
  }[block.type];

  const prefix = () => {
    switch (block.type) {
      case "todo":
        return (
          <input
            type="checkbox"
            checked={!!block.checked}
            onChange={(e) => onChange({ checked: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-sunset-coral"
          />
        );
      case "bullet":
        return <span className="shrink-0 select-none text-muted-foreground w-4 text-center text-base leading-relaxed font-semibold">•</span>;
      case "numbered":
        return <span className="shrink-0 select-none text-muted-foreground text-base leading-relaxed font-medium">{listNumber ?? 1}.</span>;
      default:
        return null;
    }
  };

  return (
    <div className="group relative flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-surface/40">
      {prefix()}
      <div className="min-w-0 flex-1">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onFocus={onFocused}
          onInput={(e) => {
            const target = e.target as HTMLDivElement;
            const text = target.innerText;

            // Känn av Markdown-genvägar i början av blocket
            if (text === "[] " || text === "[ ] " || text === "- [ ] ") {
              target.innerText = "";
              onChange({ type: "todo", text: "" });
              return;
            }
            if (text === "- " || text === "* ") {
              target.innerText = "";
              onChange({ type: "bullet", text: "" });
              return;
            }
            if (text === "1. ") {
              target.innerText = "";
              onChange({ type: "numbered", text: "" });
              return;
            }
            if (text === "> ") {
              target.innerText = "";
              onChange({ type: "quote", text: "" });
              return;
            }

            onChange({ text });
            if (text === "/") onSlash();
            else if (!text.startsWith("/")) onCloseSlash();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onCloseSlash();
              if (block.text === "" && ["bullet", "numbered", "todo"].includes(block.type)) {
                onChange({ type: "text" });
              } else {
                onEnter();
              }
            } else if (e.key === "Backspace" && (e.target as HTMLDivElement).innerText === "") {
              e.preventDefault();
              if (block.type !== "text") {
                onChange({ type: "text" });
              } else {
                onBackspaceEmpty();
              }
            } else if (e.key === "Escape") {
              onCloseSlash();
            } else if (e.key === "ArrowDown" && isLast && onArrowDownLast) {
              onArrowDownLast();
            }
          }}
          className={cn(
            "min-h-[1.75rem] w-full outline-none",
            typographyClass,
            block.type === "todo" && block.checked && "line-through text-muted-foreground",
            "empty:before:pointer-events-none empty:before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]",
          )}
        />
        {slashOpen && (
          <div className="mt-1 w-72 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
            <div className="border-b border-border/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Block
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {SLASH_MENU.map((item) => (
                <button
                  key={item.type}
                  onClick={() => {
                    onChange({ text: "" });
                    onPickType(item.type);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="grid h-7 w-7 place-items-center rounded border border-border/60 bg-surface text-muted-foreground">
                    {item.icon}
                  </span>
                  <span className="flex-1">
                    <div className="text-sm">{item.label}</div>
                    <div className="text-[11px] text-muted-foreground">{item.hint}</div>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
