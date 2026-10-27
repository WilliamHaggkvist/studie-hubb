// Modern block editor with rich text and permanent cloud image support.
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  ListChecks,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code,
  Trash2,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
  Maximize2,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { uploadNoteImage } from "@/lib/note-images";

export type Block = {
  id: string;
  type:
    | "text"
    | "h1"
    | "h2"
    | "h3"
    | "todo"
    | "bullet"
    | "numbered"
    | "quote"
    | "divider"
    | "code"
    | "image";
  text: string;
  url?: string;
  caption?: string;
  checked?: boolean;
};

const rid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(
  type: Block["type"] = "text",
  text = "",
  url?: string,
  caption?: string
): Block {
  return { id: rid(), type, text, url, caption };
}

const SLASH_MENU: {
  type: Block["type"];
  label: string;
  icon: React.ReactNode;
  hint: string;
}[] = [
  { type: "text", label: "Text", icon: <Type className="h-4 w-4" />, hint: "Vanlig text" },
  { type: "h1", label: "Rubrik 1", icon: <Heading1 className="h-4 w-4" />, hint: "Stor rubrik" },
  { type: "h2", label: "Rubrik 2", icon: <Heading2 className="h-4 w-4" />, hint: "Mellanrubrik" },
  { type: "h3", label: "Rubrik 3", icon: <Heading3 className="h-4 w-4" />, hint: "Liten rubrik" },
  {
    type: "image",
    label: "Bild",
    icon: <ImageIcon className="h-4 w-4" />,
    hint: "Ladda upp eller klistra in bild",
  },
  { type: "todo", label: "Att göra", icon: <ListChecks className="h-4 w-4" />, hint: "Checkbox" },
  { type: "bullet", label: "Punktlista", icon: <List className="h-4 w-4" />, hint: "• lista" },
  {
    type: "numbered",
    label: "Numrerad lista",
    icon: <ListOrdered className="h-4 w-4" />,
    hint: "1. lista",
  },
  { type: "quote", label: "Citat", icon: <Quote className="h-4 w-4" />, hint: "Blockcitat" },
  { type: "code", label: "Kod", icon: <Code className="h-4 w-4" />, hint: "Kodblock" },
  {
    type: "divider",
    label: "Avdelare",
    icon: <Minus className="h-4 w-4" />,
    hint: "Horisontell linje",
  },
];

export function BlockEditor({
  value,
  onChange,
  onRegisterUploadImage,
}: {
  value: Block[];
  onChange: (blocks: Block[]) => void;
  onRegisterUploadImage?: (trigger: (file: File) => Promise<void>) => void;
}) {
  const blocks =
    value.length > 0 ? value : [{ id: "fallback-block", type: "text", text: "" } as Block];
  const [focusId, setFocusId] = useState<string | null>(null);
  const [slashFor, setSlashFor] = useState<string | null>(null);
  const [uploadingBlockIds, setUploadingBlockIds] = useState<Set<string>>(new Set());

  const update = useCallback(
    (id: string, patch: Partial<Block>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [blocks, onChange]
  );

  const insertAfter = useCallback(
    (id: string, type: Block["type"] = "text") => {
      const idx = blocks.findIndex((b) => b.id === id);
      const b = newBlock(type);
      const next = [...blocks.slice(0, idx + 1), b, ...blocks.slice(idx + 1)];
      onChange(next);
      setFocusId(b.id);
    },
    [blocks, onChange]
  );

  const remove = useCallback(
    (id: string) => {
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
            },
          },
        });
        return;
      }

      const deletedBlock = blocks[idx];
      const next = blocks.filter((b) => b.id !== id);
      onChange(next);
      const nextFocusIdx = idx > 0 ? idx - 1 : 0;
      setFocusId(next[nextFocusIdx]?.id ?? null);

      toast.success(deletedBlock.type === "image" ? "Bild borttagen" : "Block borttaget", {
        action: {
          label: "Ångra",
          onClick: () => {
            const restored = [...next.slice(0, idx), deletedBlock, ...next.slice(idx)];
            onChange(restored);
          },
        },
      });
    },
    [blocks, onChange]
  );

  const changeType = useCallback(
    (id: string, type: Block["type"]) => {
      update(id, { type });
      setSlashFor(null);
      setFocusId(id);
    },
    [update]
  );

  // Upload an image and insert/update an image block
  const uploadAndInsertImage = useCallback(
    async (file: File, targetBlockId?: string) => {
      const targetIdx = targetBlockId
        ? blocks.findIndex((b) => b.id === targetBlockId)
        : blocks.length - 1;

      const targetBlock = targetIdx >= 0 ? blocks[targetIdx] : null;
      const isTargetEmptyText =
        targetBlock && targetBlock.type === "text" && targetBlock.text.trim() === "";

      // Preview URL while uploading
      const previewUrl = URL.createObjectURL(file);
      const imageBlockId = isTargetEmptyText ? targetBlock.id : rid();
      const newImgBlock: Block = {
        id: imageBlockId,
        type: "image",
        text: previewUrl,
        url: previewUrl,
        caption: file.name.replace(/\.[^/.]+$/, ""),
      };

      const followingTextBlock = newBlock("text", "");

      let nextBlocks: Block[];
      if (isTargetEmptyText) {
        nextBlocks = [
          ...blocks.slice(0, targetIdx),
          newImgBlock,
          followingTextBlock,
          ...blocks.slice(targetIdx + 1),
        ];
      } else if (targetIdx >= 0) {
        nextBlocks = [
          ...blocks.slice(0, targetIdx + 1),
          newImgBlock,
          followingTextBlock,
          ...blocks.slice(targetIdx + 1),
        ];
      } else {
        nextBlocks = [...blocks, newImgBlock, followingTextBlock];
      }

      onChange(nextBlocks);
      setFocusId(followingTextBlock.id);
      setUploadingBlockIds((prev) => new Set(prev).add(imageBlockId));

      try {
        toast.loading("Laddar upp bild till molnet…", { id: `up-${imageBlockId}` });
        const permanentUrl = await uploadNoteImage(file);

        onChange(
          nextBlocks.map((b) =>
            b.id === imageBlockId
              ? { ...b, url: permanentUrl, text: permanentUrl }
              : b
          )
        );
        toast.success("Bild sparad i anteckningen!", { id: `up-${imageBlockId}` });
      } catch (err) {
        console.error("Image upload failed:", err);
        toast.error(err instanceof Error ? err.message : "Kunde inte ladda upp bild", {
          id: `up-${imageBlockId}`,
        });
        // Ta bort misslyckat bildblock
        onChange(nextBlocks.filter((b) => b.id !== imageBlockId));
      } finally {
        URL.revokeObjectURL(previewUrl);
        setUploadingBlockIds((prev) => {
          const next = new Set(prev);
          next.delete(imageBlockId);
          return next;
        });
      }
    },
    [blocks, onChange]
  );

  // Expose upload function to parent if requested
  useEffect(() => {
    if (onRegisterUploadImage) {
      onRegisterUploadImage((file: File) => uploadAndInsertImage(file));
    }
  }, [onRegisterUploadImage, uploadAndInsertImage]);

  // Insert image via direct URL
  const insertImageUrl = useCallback(
    (url: string, targetBlockId?: string) => {
      const idx = targetBlockId ? blocks.findIndex((b) => b.id === targetBlockId) : -1;
      const imgBlock = newBlock("image", url, url);
      const textBlock = newBlock("text", "");

      let next: Block[];
      if (idx >= 0 && blocks[idx].type === "text" && blocks[idx].text.trim() === "") {
        next = [...blocks.slice(0, idx), imgBlock, textBlock, ...blocks.slice(idx + 1)];
      } else if (idx >= 0) {
        next = [...blocks.slice(0, idx + 1), imgBlock, textBlock, ...blocks.slice(idx + 1)];
      } else {
        next = [...blocks, imgBlock, textBlock];
      }

      onChange(next);
      setFocusId(textBlock.id);
      toast.success("Bild tillagd");
    },
    [blocks, onChange]
  );

  const handleWrapperClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock) {
        if (
          lastBlock.text !== "" ||
          lastBlock.type === "divider" ||
          lastBlock.type === "image"
        ) {
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

  // Drag & drop files on entire editor
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files || []);
    const imgFile = files.find((f) => f.type.startsWith("image/"));
    if (imgFile) {
      e.preventDefault();
      await uploadAndInsertImage(imgFile);
    }
  };

  // Global paste fallback for editor wrapper
  const handleWrapperPaste = async (e: React.ClipboardEvent) => {
    if (e.defaultPrevented) return;
    const files = Array.from(e.clipboardData.files || []);
    const imgFile = files.find((f) => f.type.startsWith("image/"));
    if (imgFile) {
      e.preventDefault();
      await uploadAndInsertImage(imgFile, focusId || undefined);
    }
  };

  return (
    <div
      className="space-y-1 min-h-[350px] cursor-text pb-28 outline-none"
      onClick={handleWrapperClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handleWrapperPaste}
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

        if (b.type === "image") {
          return (
            <ImageBlockRow
              key={b.id}
              block={b}
              isUploading={uploadingBlockIds.has(b.id)}
              onRemove={() => remove(b.id)}
              onChange={(patch) => update(b.id, patch)}
              onEnter={() => insertAfter(b.id, "text")}
              onUploadFile={(file) => uploadAndInsertImage(file, b.id)}
            />
          );
        }

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
            onInsertImageFile={(file) => uploadAndInsertImage(file, b.id)}
            onInsertImageUrl={(url) => insertImageUrl(url, b.id)}
          />
        );
      })}
    </div>
  );
}

function ImageBlockRow({
  block,
  isUploading,
  onRemove,
  onChange,
  onEnter,
  onUploadFile,
}: {
  block: Block;
  isUploading: boolean;
  onRemove: () => void;
  onChange: (patch: Partial<Block>) => void;
  onEnter: () => void;
  onUploadFile: (file: File) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlField, setShowUrlField] = useState(false);
  const imageUrl = block.url || block.text;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  if (isUploading) {
    return (
      <div className="relative rounded-2xl border border-dashed border-primary/40 bg-surface/40 p-8 my-3 flex flex-col items-center justify-center gap-3 backdrop-blur-sm animate-pulse">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Laddar upp bild…</p>
          <p className="text-xs text-muted-foreground">Sparar säkert i molnet så den aldrig försvinner</p>
        </div>
      </div>
    );
  }

  // Om blocket saknar bild (t.ex. nyss valt från /bild men inte laddat upp än)
  if (!imageUrl) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-surface/30 p-5 my-2 max-w-xl transition-all hover:border-primary/50">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Lägg till bild i anteckningen</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Klistra in med Ctrl+V, dra och släpp, eller välj en bildfil
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
            >
              <UploadCloud className="h-3.5 w-3.5" /> Välj bild från datorn
            </button>
            <button
              type="button"
              onClick={() => setShowUrlField((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-surface-2/60 text-xs font-medium hover:bg-surface-2 transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <Link2 className="h-3.5 w-3.5" /> Webblänk
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="Avbryt / ta bort"
            >
              Avbryt
            </button>
          </div>

          {showUrlField && (
            <div className="w-full flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://exempel.se/bild.png"
                className="flex-1 bg-surface-2/60 border border-border/60 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => {
                  if (urlInput.trim()) {
                    onChange({ url: urlInput.trim(), text: urlInput.trim() });
                  }
                }}
                className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
              >
                Lägg till
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group/image relative my-3 max-w-3xl rounded-2xl border border-border/50 bg-surface/30 overflow-hidden shadow-sm transition-all hover:border-border hover:shadow-md">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="relative overflow-hidden bg-black/10 flex items-center justify-center min-h-[120px]">
        <img
          src={imageUrl}
          alt={block.caption || "Anteckningsbild"}
          loading="lazy"
          className="max-h-[550px] w-auto max-w-full object-contain mx-auto transition-transform"
        />

        {/* Hover-kontroller uppe till höger */}
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center gap-1.5 bg-background/80 backdrop-blur-md border border-border/50 rounded-xl p-1 shadow-lg z-10">
          <button
            type="button"
            title="Öppna bild i full storlek"
            onClick={() => window.open(imageUrl, "_blank")}
            className="p-1.5 hover:bg-surface-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Ersätt med ny bild"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 hover:bg-surface-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <UploadCloud className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Ta bort bild"
            onClick={onRemove}
            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bildtext / Caption */}
      <div className="px-3.5 py-2 border-t border-border/30 bg-surface-2/20 flex items-center gap-2">
        <input
          type="text"
          value={block.caption ?? ""}
          placeholder="Lägg till en bildtext (valfritt)…"
          onChange={(e) => onChange({ caption: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/40 outline-none focus:text-foreground"
        />
      </div>
    </div>
  );
}

function BlockRow({
  block,
  focused,
  onFocused,
  onChange,
  onEnter,
  onBackspaceEmpty,
  onSlash,
  slashOpen,
  onCloseSlash,
  onPickType,
  onInsertImageFile,
  onInsertImageUrl,
  listNumber,
  isLast,
  onArrowDownLast,
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
  onInsertImageFile: (file: File) => Promise<void>;
  onInsertImageUrl: (url: string) => void;
  listNumber?: number;
  isLast?: boolean;
  onArrowDownLast?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();

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
        } catch {
          // Ignorera urvalsfel
        }
      }
    }
  }, [focused, block.text]);

  useEffect(() => {
    if (
      ref.current &&
      document.activeElement !== ref.current &&
      ref.current.innerText !== block.text
    ) {
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

  const placeholder = focused ? "Skriv '/' för kommandon eller klistra in en bild…" : "";

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
    image: "",
  }[block.type];

  const prefix = () => {
    switch (block.type) {
      case "todo":
        return (
          <input
            type="checkbox"
            checked={!!block.checked}
            onChange={(e) => onChange({ checked: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-sunset-coral cursor-pointer"
          />
        );
      case "bullet":
        return (
          <span className="shrink-0 select-none text-muted-foreground w-4 text-center text-base leading-relaxed font-semibold">
            •
          </span>
        );
      case "numbered":
        return (
          <span className="shrink-0 select-none text-muted-foreground text-base leading-relaxed font-medium">
            {listNumber ?? 1}.
          </span>
        );
      default:
        return null;
    }
  };

  // Hantera inklistring av bilder i textblock
  const handlePaste = async (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []);
    const imgFile = files.find((f) => f.type.startsWith("image/"));
    if (imgFile) {
      e.preventDefault();
      await onInsertImageFile(imgFile);
      return;
    }

    // Kolla om urklipp innehåller en <img> tagg med data-url eller länk
    const html = e.clipboardData.getData("text/html");
    if (html && html.includes("<img") && !imgFile) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) {
        const src = match[1];
        if (src.startsWith("data:image/")) {
          e.preventDefault();
          try {
            const res = await fetch(src);
            const blob = await res.blob();
            const file = new File([blob], `pasted-${Date.now()}.png`, {
              type: blob.type || "image/png",
            });
            await onInsertImageFile(file);
            return;
          } catch (err) {
            console.error("Failed to parse pasted data image:", err);
          }
        } else if (src.startsWith("http://") || src.startsWith("https://")) {
          e.preventDefault();
          onInsertImageUrl(src);
          return;
        }
      }
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
          onPaste={handlePaste}
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
            if (text.toLowerCase() === "/bild" || text.toLowerCase() === "/image") {
              target.innerText = "";
              onPickType("image");
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
            "empty:before:pointer-events-none empty:before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]"
          )}
        />
        {slashOpen && (
          <div className="mt-1 w-72 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl z-20">
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
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent cursor-pointer"
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
