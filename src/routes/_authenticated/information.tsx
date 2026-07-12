import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Info, 
  BookOpen, 
  Link as LinkIcon, 
  Mail, 
  User, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  ExternalLink,
  Phone,
  FileText,
  Upload,
  Loader2,
  Sparkles,
  Download,
  Eye
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/information")({
  component: InformationPage,
});

interface InfoLink {
  id: string;
  title: string;
  url: string;
}

interface InfoFile {
  id: string;
  name: string;
  url: string;
}

interface ProgramInfo {
  name: string;
  links: InfoLink[];
  files: InfoFile[];
}

interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface CustomCard {
  id: string;
  title: string;
  content?: string;
  color: string;
  imageUrl?: string;
}

const DEFAULT_PROGRAM: ProgramInfo = {
  name: "Kandidatprogram i datavetenskap",
  links: [
    { id: "1", title: "Officiell kursplan", url: "https://www.su.se/utbildning/alla-amnen/datavetenskap-kandidatprogram-180-hp-1.446132" }
  ],
  files: []
};

const DEFAULT_CONTACTS: Contact[] = [
  {
    id: "1",
    name: "Anna Bengtsson",
    role: "Studievägledare",
    email: "svl@dsv.su.se",
    phone: "08-16 12 34"
  },
  {
    id: "2",
    name: "Karl Andersson",
    role: "Programansvarig",
    email: "programansvarig@dsv.su.se",
    phone: ""
  }
];

const DEFAULT_CUSTOM_CARDS: CustomCard[] = [
  {
    id: "1",
    title: "Terminstider",
    content: "Höstterminen 2026: 31 augusti – 17 januari\nVårterminen 2027: 18 januari – 6 juni",
    color: "from-purple-500/10 to-purple-500/5 hover:border-purple-500/30 text-purple-400"
  }
];

const CARD_COLORS = [
  { name: "Lila", class: "from-purple-500/10 to-purple-500/5 hover:border-purple-500/30 text-purple-400" },
  { name: "Orange", class: "from-orange-500/10 to-orange-500/5 hover:border-orange-500/30 text-orange-400" },
  { name: "Cyan", class: "from-cyan-500/10 to-cyan-500/5 hover:border-cyan-500/30 text-cyan-400" },
  { name: "Grön", class: "from-emerald-500/10 to-emerald-500/5 hover:border-emerald-500/30 text-emerald-400" },
  { name: "Rosa", class: "from-pink-500/10 to-pink-500/5 hover:border-pink-500/30 text-pink-400" }
];

function InformationPage() {
  const [program, setProgram] = useState<ProgramInfo>(DEFAULT_PROGRAM);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customCards, setCustomCards] = useState<CustomCard[]>([]);

  // Editing program state
  const [isEditingProgram, setIsEditingProgram] = useState(false);
  const [progName, setProgName] = useState("");
  const [progLinks, setProgLinks] = useState<InfoLink[]>([]);
  const [progFiles, setProgFiles] = useState<InfoFile[]>([]);
  const [fileLoading, setFileLoading] = useState(false);

  // Temp fields for adding link inside dialog
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  // Contact modal states
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Custom Card modal states
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CustomCard | null>(null);
  const [cardTitle, setCardTitle] = useState("");
  const [cardContent, setCardContent] = useState("");
  const [cardColor, setCardColor] = useState(CARD_COLORS[0].class);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [cardImageLoading, setCardImageLoading] = useState(false);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const savedProgram = localStorage.getItem("info_program_multi");
    const savedContacts = localStorage.getItem("info_contacts_simple");
    const savedCards = localStorage.getItem("info_custom_cards_simple");

    if (savedProgram) {
      try {
        const parsed = JSON.parse(savedProgram);
        // Migration check
        if (!parsed.links) parsed.links = [];
        if (!parsed.files) parsed.files = [];
        setProgram(parsed);
      } catch (e) {
        setProgram(DEFAULT_PROGRAM);
      }
    } else {
      // Try migrating from older version
      const oldProg = localStorage.getItem("info_program_simple");
      if (oldProg) {
        try {
          const parsedOld = JSON.parse(oldProg);
          const migrated: ProgramInfo = {
            name: parsedOld.name || "Mitt Program",
            links: parsedOld.syllabusUrl ? [{ id: "1", title: "Kursplan", url: parsedOld.syllabusUrl }] : [],
            files: parsedOld.fileUrl ? [{ id: "1", name: parsedOld.fileName || "Kursplansbilaga", url: parsedOld.fileUrl }] : []
          };
          setProgram(migrated);
          localStorage.setItem("info_program_multi", JSON.stringify(migrated));
        } catch (e) {
          setProgram(DEFAULT_PROGRAM);
        }
      } else {
        setProgram(DEFAULT_PROGRAM);
      }
    }

    if (savedContacts) setContacts(JSON.parse(savedContacts));
    else setContacts(DEFAULT_CONTACTS);

    if (savedCards) setCustomCards(JSON.parse(savedCards));
    else setCustomCards(DEFAULT_CUSTOM_CARDS);
  }, []);

  const saveProgram = (newProg: ProgramInfo) => {
    setProgram(newProg);
    localStorage.setItem("info_program_multi", JSON.stringify(newProg));
  };

  const saveContacts = (newContacts: Contact[]) => {
    setContacts(newContacts);
    localStorage.setItem("info_contacts_simple", JSON.stringify(newContacts));
  };

  const saveCustomCards = (newCards: CustomCard[]) => {
    setCustomCards(newCards);
    localStorage.setItem("info_custom_cards_simple", JSON.stringify(newCards));
  };

  // Program Handlers
  const handleOpenEditProgram = () => {
    setProgName(program.name);
    setProgLinks([...program.links]);
    setProgFiles([...program.files]);
    setNewLinkTitle("");
    setNewLinkUrl("");
    setIsEditingProgram(true);
  };

  const handleAddLinkToProgram = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) {
      toast.error("Fyll i både titel och länk");
      return;
    }
    const formattedUrl = newLinkUrl.startsWith("http") ? newLinkUrl : `https://${newLinkUrl}`;
    const newLink: InfoLink = {
      id: Date.now().toString(),
      title: newLinkTitle.trim(),
      url: formattedUrl
    };
    setProgLinks([...progLinks, newLink]);
    setNewLinkTitle("");
    setNewLinkUrl("");
  };

  const handleRemoveLinkFromProgram = (id: string) => {
    setProgLinks(progLinks.filter(l => l.id !== id));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    let finalUrl = "";

    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const path = `${u.user.id}/study-program/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("course-files")
          .upload(path, file, { upsert: false });

        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from("course-files")
            .getPublicUrl(path);

          if (urlData?.publicUrl) {
            finalUrl = urlData.publicUrl;
            const newFile: InfoFile = {
              id: Date.now().toString(),
              name: file.name,
              url: finalUrl
            };
            setProgFiles([...progFiles, newFile]);
            toast.success("Dokument uppladdat!");
            setFileLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Supabase upload failed, falling back to base64...", err);
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Filen är för stor (max 2MB för lokal lagring)");
      setFileLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        finalUrl = event.target.result as string;
        const newFile: InfoFile = {
          id: Date.now().toString(),
          name: file.name,
          url: finalUrl
        };
        setProgFiles([...progFiles, newFile]);
        toast.success("Dokument sparat lokalt!");
      }
      setFileLoading(false);
    };
    reader.onerror = () => {
      toast.error("Kunde inte läsa filen");
      setFileLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFileFromProgram = (id: string) => {
    setProgFiles(progFiles.filter(f => f.id !== id));
  };

  const handleSaveProgram = () => {
    if (!progName.trim()) {
      toast.error("Programnamn måste anges");
      return;
    }
    const updated: ProgramInfo = {
      name: progName.trim(),
      links: progLinks,
      files: progFiles
    };
    saveProgram(updated);
    setIsEditingProgram(false);
    toast.success("Ändringarna sparade!");
  };

  // Contact Handlers
  const handleOpenAddContact = () => {
    setEditingContact(null);
    setContactName("");
    setContactRole("");
    setContactEmail("");
    setContactPhone("");
    setIsContactOpen(true);
  };

  const handleOpenEditContact = (c: Contact) => {
    setEditingContact(c);
    setContactName(c.name);
    setContactRole(c.role);
    setContactEmail(c.email);
    setContactPhone(c.phone);
    setIsContactOpen(true);
  };

  const handleSaveContact = () => {
    if (!contactName.trim()) {
      toast.error("Namn måste anges");
      return;
    }

    if (editingContact) {
      const updated = contacts.map(c => c.id === editingContact.id ? {
        ...c,
        name: contactName.trim(),
        role: contactRole.trim(),
        email: contactEmail.trim(),
        phone: contactPhone.trim()
      } : c);
      saveContacts(updated);
      toast.success("Kontakt uppdaterad!");
    } else {
      const newContact: Contact = {
        id: Date.now().toString(),
        name: contactName.trim(),
        role: contactRole.trim(),
        email: contactEmail.trim(),
        phone: contactPhone.trim()
      };
      saveContacts([...contacts, newContact]);
      toast.success("Kontakt tillagd!");
    }
    setIsContactOpen(false);
  };

  const handleDeleteContact = (id: string, name: string) => {
    if (confirm(`Ta bort kontakten "${name}"?`)) {
      saveContacts(contacts.filter(c => c.id !== id));
      toast.success("Kontakt borttagen");
    }
  };

  // Custom Card Handlers
  const handleOpenAddCard = () => {
    setEditingCard(null);
    setCardTitle("");
    setCardContent("");
    setCardColor(CARD_COLORS[0].class);
    setCardImageUrl(null);
    setIsCardOpen(true);
  };

  const handleOpenEditCard = (c: CustomCard) => {
    setEditingCard(c);
    setCardTitle(c.title);
    setCardContent(c.content || "");
    setCardColor(c.color);
    setCardImageUrl(c.imageUrl || null);
    setIsCardOpen(true);
  };

  const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Kunde inte skapa canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Kunde inte ladda bilden"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Kunde inte läsa filen"));
      reader.readAsDataURL(file);
    });
  };

  const handleCardImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCardImageLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const path = `${u.user.id}/info-cards/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("course-files")
          .upload(path, file, { upsert: false });

        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from("course-files")
            .getPublicUrl(path);

          if (urlData?.publicUrl) {
            setCardImageUrl(urlData.publicUrl);
            toast.success("Bild uppladdad!");
            setCardImageLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Supabase card image upload failed, falling back to base64...", err);
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setCardImageUrl(compressedDataUrl);
      toast.success("Bild tillagd lokalt!");
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte läsa eller komprimera bilden");
    } finally {
      setCardImageLoading(false);
    }
  };

  const handleSaveCard = () => {
    if (!cardTitle.trim()) {
      toast.error("Rubrik måste anges");
      return;
    }

    if (editingCard) {
      const updated = customCards.map(c => c.id === editingCard.id ? {
        ...c,
        title: cardTitle.trim(),
        content: cardContent.trim() || undefined,
        color: cardColor,
        imageUrl: cardImageUrl || undefined
      } : c);
      saveCustomCards(updated);
      toast.success("Kort uppdaterat!");
    } else {
      const newCard: CustomCard = {
        id: Date.now().toString(),
        title: cardTitle.trim(),
        content: cardContent.trim() || undefined,
        color: cardColor,
        imageUrl: cardImageUrl || undefined
      };
      saveCustomCards([...customCards, newCard]);
      toast.success("Kort tillagt!");
    }
    setIsCardOpen(false);
  };

  const handleDeleteCard = (id: string, title: string) => {
    if (confirm(`Ta bort kortet "${title}"?`)) {
      saveCustomCards(customCards.filter(c => c.id !== id));
      toast.success("Kort borttaget");
    }
  };

  const handleOpenPreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setIsPreviewOpen(true);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8 relative min-h-screen">
      {/* Glow blobs */}
      <div className="absolute top-12 left-12 -z-10 h-72 w-72 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-12 -z-10 h-96 w-96 rounded-full bg-sunset-orange/5 blur-[120px] pointer-events-none" />

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-sunset-orange to-sunset-amber bg-clip-text text-transparent">
            Information
          </h1>
        </div>
        <Info className="h-10 w-10 text-primary/40 hidden sm:block" />
      </div>

      <div className="space-y-8">
        {/* Simplified main card: Mitt Program */}
        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-sunset-orange" />
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="h-5.5 w-5.5 text-primary shrink-0" />
                {program.name || "Mitt Program"}
              </CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full bg-background/30 hover:bg-background/80" 
              onClick={handleOpenEditProgram}
              title="Redigera program, länkar och filer"
            >
              <Edit2 className="h-4.5 w-4.5 text-muted-foreground" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Länkar och dokument Section */}
            <div className="space-y-4 pb-6 border-b border-border/40">
              <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                <LinkIcon className="h-4 w-4 text-primary" />
                Länkar och dokument
              </h3>
              
              <div className="space-y-4">
                {/* Links list */}
                <div>
                  <h4 className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Länkar</h4>
                  <div className="flex flex-wrap gap-2">
                    {program.links && program.links.length > 0 ? (
                      program.links.map((link) => (
                        <a 
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-sunset-orange bg-primary/5 hover:bg-primary/10 border border-primary/10 px-3 py-1.5 rounded-xl transition-all"
                        >
                          {link.title}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Inga länkar tillagda.</span>
                    )}
                  </div>
                </div>

                {/* Files list */}
                <div>
                  <h4 className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Dokument</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {program.files && program.files.length > 0 ? (
                      program.files.map((file) => (
                        <div 
                          key={file.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-background/30 hover:border-primary/20 hover:bg-background/40 transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-xs font-semibold text-foreground truncate">{file.name}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenPreview(file.url, file.name)}
                              className="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary"
                              title="Visa fil"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <a
                              href={file.url}
                              download={file.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                              title="Ladda ned"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic sm:col-span-2">Inga dokument bifogade.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Contacts list inside program card */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Viktiga kontakter
                </h3>
                <Button 
                  onClick={handleOpenAddContact}
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-xl text-xs gap-1 border-primary/20 text-primary hover:bg-primary/5"
                >
                  <Plus className="h-3.5 w-3.5" /> Lägg till kontakt
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {contacts.map((contact) => (
                  <div 
                    key={contact.id}
                    className="p-3.5 rounded-xl border border-border/40 bg-background/30 transition-all duration-200 group/contact relative"
                  >
                    <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover/contact:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenEditContact(contact)}
                        className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background/80"
                        title="Redigera"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button 
                        onClick={() => handleDeleteContact(contact.id, contact.name)}
                        className="p-1 text-red-500/70 hover:text-red-500 rounded-lg hover:bg-background/80"
                        title="Ta bort"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <h4 className="text-xs font-bold text-foreground leading-none pr-12">{contact.name}</h4>
                        {contact.role && <span className="text-[10px] text-muted-foreground mt-1 block">{contact.role}</span>}
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-border/30 mt-1.5">
                        {contact.email && (
                          <a 
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1.5 text-[10px] text-primary hover:text-sunset-orange"
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </a>
                        )}
                        {contact.phone && (
                          <a 
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span>{contact.phone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {contacts.length === 0 && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground italic text-center py-4">Inga kontakter tillagda ännu.</p>
                )}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Custom Cards Grid (Extra info) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-sunset-orange" />
              Annan information
            </h2>
            <Button 
              onClick={handleOpenAddCard}
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs gap-1 border-primary/20 text-primary hover:bg-primary/5"
            >
              <Plus className="h-3.5 w-3.5" /> Skapa informationskort
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {customCards.map((card) => (
              <Card 
                key={card.id} 
                className={`border-border/60 bg-gradient-to-br ${card.color} backdrop-blur-md rounded-2xl flex flex-col justify-between overflow-hidden relative group hover:shadow-lg transition-all duration-300`}
              >
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <CardTitle className="text-sm font-bold text-foreground leading-none pr-12">
                    {card.title}
                  </CardTitle>
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditCard(card)}
                      className="p-1 rounded-full hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
                      title="Redigera"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id, card.title)}
                      className="p-1 rounded-full hover:bg-background/80 text-red-500/70 hover:text-red-500 transition-colors"
                      title="Ta bort"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {card.imageUrl && (
                    <img 
                      src={card.imageUrl} 
                      alt={card.title} 
                      onClick={() => {
                        setPreviewUrl(card.imageUrl!);
                        setPreviewName(card.title);
                        setIsPreviewOpen(true);
                      }}
                      className="w-full max-h-48 object-cover rounded-xl border border-white/5 shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                    />
                  )}
                  {card.content && (
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {card.content}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

            {customCards.length === 0 && (
              <div className="sm:col-span-2 rounded-2xl border border-dashed border-border/60 bg-surface/40 p-8 text-center">
                <p className="text-xs text-muted-foreground italic">Inga övriga informationskort skapade.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Program Dialog */}
      <Dialog open={isEditingProgram} onOpenChange={setIsEditingProgram}>
        <DialogContent className="glass max-w-lg rounded-2xl border-white/5 shadow-2xl backdrop-blur-xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-semibold">Redigera Länkar och dokument</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Programnamn / Rubrik</Label>
              <Input value={progName} onChange={(e) => setProgName(e.target.value)} className="h-9 text-xs rounded-xl bg-background/50" />
            </div>

            {/* Links management */}
            <div className="space-y-2 pt-2 border-t border-border/20">
              <Label className="text-xs font-bold text-foreground">Hantera länkar</Label>
              
              <div className="space-y-1.5">
                {progLinks.map((l) => (
                  <div key={l.id} className="flex items-center justify-between bg-background/30 border border-border/40 rounded-xl p-2 text-xs">
                    <span className="font-semibold truncate max-w-[150px]">{l.title}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{l.url}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-red-500 hover:bg-red-500/10 rounded-lg"
                      onClick={() => handleRemoveLinkFromProgram(l.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add Link form */}
              <div className="grid grid-cols-2 gap-2 bg-primary/5 p-3 rounded-xl border border-primary/10">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground">Titel</Label>
                  <Input 
                    value={newLinkTitle} 
                    onChange={(e) => setNewLinkTitle(e.target.value)} 
                    placeholder="T.ex. Kursplan" 
                    className="h-8 text-[11px] rounded-lg bg-background/50"
                  />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground">URL</Label>
                  <Input 
                    value={newLinkUrl} 
                    onChange={(e) => setNewLinkUrl(e.target.value)} 
                    placeholder="https://..." 
                    className="h-8 text-[11px] rounded-lg bg-background/50"
                  />
                </div>
                <Button 
                  onClick={handleAddLinkToProgram}
                  type="button" 
                  size="sm"
                  className="col-span-2 mt-2 h-8 text-xs rounded-lg gradient-sunset text-white"
                >
                  Lägg till länk
                </Button>
              </div>
            </div>
            
            {/* File Upload Section inside Program edit */}
            <div className="space-y-3 pt-3 border-t border-border/20">
              <Label className="text-xs font-bold text-foreground">Hantera filer / dokument</Label>
              
              <div className="space-y-1.5">
                {progFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between bg-background/30 border border-border/40 rounded-xl p-2 text-xs">
                    <span className="font-semibold truncate max-w-[250px]">{f.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-red-500 hover:bg-red-500/10 rounded-lg"
                      onClick={() => handleRemoveFileFromProgram(f.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors rounded-xl p-6 bg-background/30 relative">
                <input 
                  type="file" 
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={fileLoading}
                />
                <div className="text-center space-y-1">
                  {fileLoading ? (
                    <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
                  )}
                  <p className="text-[11px] text-muted-foreground">Klicka för att välja eller dra ny fil hit</p>
                  <p className="text-[9px] text-muted-foreground/60">PDF eller bild (max 2MB)</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-border/20">
            <Button variant="ghost" size="sm" onClick={() => setIsEditingProgram(false)} className="rounded-xl text-xs">Avbryt</Button>
            <Button size="sm" onClick={handleSaveProgram} className="rounded-xl text-xs gradient-sunset text-white border-0 hover:opacity-90">Spara ändringar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Contact Dialog */}
      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent className="glass max-w-md rounded-2xl border-white/5 shadow-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-semibold">
              {editingContact ? "Redigera kontakt" : "Lägg till kontakt"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Namn</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-9 text-xs rounded-xl bg-background/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Roll / Titel</Label>
              <Input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="T.ex. Kursansvarig, Studievägledare..." className="h-9 text-xs rounded-xl bg-background/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">E-post</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-9 text-xs rounded-xl bg-background/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Telefonnummer</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="h-9 text-xs rounded-xl bg-background/50" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsContactOpen(false)} className="rounded-xl text-xs">Avbryt</Button>
            <Button size="sm" onClick={handleSaveContact} className="rounded-xl text-xs gradient-sunset text-white border-0 hover:opacity-90">Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Custom Card Dialog */}
      <Dialog open={isCardOpen} onOpenChange={setIsCardOpen}>
        <DialogContent className="glass max-w-md rounded-2xl border-white/5 shadow-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-semibold">
              {editingCard ? "Redigera informationskort" : "Skapa informationskort"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Rubrik</Label>
              <Input value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="T.ex. Betygskriterier, Studentkåren..." className="h-9 text-xs rounded-xl bg-background/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Färgtema</Label>
              <div className="flex gap-1.5 flex-wrap">
                {CARD_COLORS.map((col) => (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => setCardColor(col.class)}
                    className={`text-[10px] px-2.5 py-1.5 rounded-xl border border-white/10 bg-gradient-to-br ${col.class} transition-all font-semibold active:scale-95 ${cardColor === col.class ? "ring-2 ring-primary border-primary/40 scale-105" : "hover:border-white/20"}`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Innehålls-text (valfritt)</Label>
              <Textarea value={cardContent} onChange={(e) => setCardContent(e.target.value)} placeholder="Skriv din information här..." className="text-xs rounded-xl bg-background/50 min-h-[80px]" />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border/20">
              <Label className="text-xs font-semibold">Bifoga bild (valfritt)</Label>
              {cardImageUrl ? (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-xl p-2">
                  <div className="flex items-center gap-2 text-xs min-w-0">
                    <img src={cardImageUrl} alt="Card Image Preview" className="h-10 w-10 object-cover rounded-lg shrink-0" />
                    <span className="truncate text-muted-foreground text-[10px]">Bild bifogad</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-red-500 hover:bg-red-500/10 rounded-lg"
                    type="button"
                    onClick={() => setCardImageUrl(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors rounded-xl p-5 bg-background/30 relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleCardImageChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={cardImageLoading}
                  />
                  <div className="text-center space-y-1">
                    {cardImageLoading ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin mx-auto" />
                    ) : (
                      <Upload className="h-5 w-5 text-muted-foreground mx-auto" />
                    )}
                    <p className="text-[10px] text-muted-foreground">Klicka för att ladda upp bild</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsCardOpen(false)} className="rounded-xl text-xs">Avbryt</Button>
            <Button size="sm" onClick={handleSaveCard} className="rounded-xl text-xs gradient-sunset text-white border-0 hover:opacity-90">Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="glass max-w-4xl w-[90vw] h-[85vh] rounded-2xl border-white/5 shadow-2xl backdrop-blur-xl flex flex-col p-6">
          <DialogHeader className="pb-2 border-b border-border/20">
            <DialogTitle className="font-display text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span>Förhandsvisa: {previewName}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 bg-background/30 rounded-xl border border-border/30 overflow-hidden flex items-center justify-center relative p-2">
            {previewUrl ? (
              previewUrl.startsWith("data:application/pdf") || previewUrl.endsWith(".pdf") ? (
                <iframe 
                  src={previewUrl} 
                  className="w-full h-full rounded-lg" 
                  title="PDF Preview"
                />
              ) : (
                <img 
                  src={previewUrl} 
                  alt={previewName || "Preview"} 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                />
              )
            ) : (
              <p className="text-xs text-muted-foreground">Kunde inte hitta någon bilaga att förhandsvisa.</p>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border/20 flex justify-between sm:justify-between">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl text-xs gap-1.5"
                onClick={() => {
                  if (previewUrl) {
                    const win = window.open();
                    if (win) {
                      if (previewUrl.startsWith("data:")) {
                        win.document.write(`<iframe src="${previewUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                      } else {
                        win.location.href = previewUrl;
                      }
                    } else {
                      toast.error("Popup blockerad, vänligen tillåt popups.");
                    }
                  }
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Öppna i ny flik
              </Button>
              <a
                href={previewUrl || ""}
                download={previewName || "Dokument"}
                className="inline-flex items-center justify-center border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs px-3 py-1.5 rounded-xl transition-all gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Ladda ned
              </a>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsPreviewOpen(false)} className="rounded-xl text-xs">
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
