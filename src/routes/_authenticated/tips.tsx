import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import STUDY_PLACES_RAW from "@/lib/study-places.json";
import { 
  MapPin, 
  Brain, 
  Sparkles, 
  Monitor, 
  HeartHandshake, 
  Compass, 
  Star, 
  Wifi, 
  Coffee, 
  Plug, 
  Volume2, 
  Clock, 
  ExternalLink, 
  Heart, 
  Search, 
  Filter,
  Plus,
  Trash2,
  Edit2
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/tips")({
  component: TipsPage,
});

interface LinkItem {
  text: string;
  url: string;
}

interface QuickLink {
  id: string;
  title: string;
  url: string;
}

interface StudyPlace {
  id: string;
  name: string;
  description: string;
  busyLevel: "Låg" | "Medel" | "Hög";
  rating: number; // 1 to 5
  soundLevel: "Låg" | "Medellåg" | "Medel" | "Medelhög";
  links: LinkItem[];
  pentry: boolean;
  location: string;
  powerOutlets: string;
  wifi: boolean;
  hours: string;
}

const STUDY_PLACES = STUDY_PLACES_RAW as StudyPlace[];

const BUTTON_GRADIENTS = [
  "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 hover:border-purple-500/40",
  "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 hover:border-orange-500/40",
  "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40",
  "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40",
  "bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 hover:border-pink-500/40"
];

function TipsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedSoundLevel, setSelectedSoundLevel] = useState("all");
  const [filterPentry, setFilterPentry] = useState(false);
  const [filterWifi, setFilterWifi] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<string[]>([]);
  
  // Quick links state
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Load bookmarks
  useEffect(() => {
    const saved = localStorage.getItem("saved_study_places");
    if (saved) {
      try {
        setSavedPlaces(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Load quick links
  useEffect(() => {
    const savedLinks = localStorage.getItem("datasalar_quick_links");
    if (savedLinks) {
      try {
        setQuickLinks(JSON.parse(savedLinks));
      } catch (e) {
        console.error(e);
      }
    } else {
      setQuickLinks([
        { id: "1", title: "Boka datasal", url: "https://www.su.se/utbildning/din-studenttid/it-for-studenter" },
        { id: "2", title: "Mjukvara för studenter", url: "https://www.su.se/utbildning/din-studenttid/it-for-studenter/programvara-for-studenter-1.446549" }
      ]);
    }
  }, []);

  const saveQuickLinks = (links: QuickLink[]) => {
    setQuickLinks(links);
    localStorage.setItem("datasalar_quick_links", JSON.stringify(links));
  };

  const addQuickLink = () => {
    if (newLinkTitle.trim() && newLinkUrl.trim()) {
      const url = newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`;
      const newLink = { id: Date.now().toString(), title: newLinkTitle, url };
      saveQuickLinks([...quickLinks, newLink]);
      setNewLinkTitle("");
      setNewLinkUrl("");
    }
  };

  const removeQuickLink = (id: string) => {
    saveQuickLinks(quickLinks.filter(l => l.id !== id));
  };

  const toggleSavePlace = (id: string) => {
    const next = savedPlaces.includes(id)
      ? savedPlaces.filter((x) => x !== id)
      : [...savedPlaces, id];
    setSavedPlaces(next);
    localStorage.setItem("saved_study_places", JSON.stringify(next));
  };

  // Get unique locations/campuses dynamically from multi-tags
  const locations = useMemo(() => {
    const tags = new Set<string>();
    STUDY_PLACES.forEach((p) => {
      const parts = p.location.split(/[,\/]/);
      parts.forEach((part) => {
        const trimmed = part.trim();
        if (trimmed && trimmed !== "Okänd") {
          tags.add(trimmed);
        }
      });
    });
    return ["all", ...Array.from(tags).sort()];
  }, []);

  // Filter logic
  const filteredPlaces = useMemo(() => {
    return STUDY_PLACES.filter((place) => {
      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = place.name.toLowerCase().includes(q);
        const matchLoc = place.location.toLowerCase().includes(q);
        const matchDesc = place.description.toLowerCase().includes(q);
        if (!matchName && !matchLoc && !matchDesc) return false;
      }

      // Campus filter (searches inside split tags)
      if (selectedLocation !== "all") {
        const parts = place.location.split(/[,\/]/).map((x) => x.trim().toLowerCase());
        if (!parts.includes(selectedLocation.toLowerCase())) {
          return false;
        }
      }

      // Sound level filter
      if (selectedSoundLevel !== "all" && place.soundLevel !== selectedSoundLevel) {
        return false;
      }

      // Pentry filter
      if (filterPentry && !place.pentry) {
        return false;
      }

      // Wifi filter
      if (filterWifi && !place.wifi) {
        return false;
      }

      // Saved places filter
      if (showSavedOnly && !savedPlaces.includes(place.id)) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedLocation, selectedSoundLevel, filterPentry, filterWifi, showSavedOnly, savedPlaces]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedLocation("all");
    setSelectedSoundLevel("all");
    setFilterPentry(false);
    setFilterWifi(false);
    setShowSavedOnly(false);
  };

  const getBusyLevelColor = (level: "Låg" | "Medel" | "Hög") => {
    switch (level) {
      case "Låg":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "Medel":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "Hög":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8 relative min-h-screen">
      {/* Decorative backdrop glow blobs for glassmorphic design */}
      <div className="absolute top-12 left-12 -z-10 h-72 w-72 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-12 -z-10 h-96 w-96 rounded-full bg-sunset-orange/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-12 left-1/3 -z-10 h-80 w-80 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-sunset-orange to-sunset-amber bg-clip-text text-transparent">
            Tips och guider
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hitta inspiration, studiemetoder och resurser för att optimera din studietid på campus.
          </p>
        </div>
        <Compass className="h-10 w-10 text-primary/40 animate-pulse hidden sm:block" />
      </div>

      <Tabs defaultValue="study-places" className="space-y-6">
        <TabsList className="bg-surface/40 backdrop-blur-md border border-border/40 p-1 flex overflow-x-auto w-full justify-start h-auto scrollbar-none gap-1 rounded-2xl">
          <TabsTrigger value="study-places" className="rounded-xl py-2 px-4 text-xs font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white hover:text-primary">
            Studieplatser
          </TabsTrigger>
          <TabsTrigger value="methods" className="rounded-xl py-2 px-4 text-xs font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white hover:text-primary">
            Metoder
          </TabsTrigger>
          <TabsTrigger value="good-advice" className="rounded-xl py-2 px-4 text-xs font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white hover:text-primary">
            Goda råd
          </TabsTrigger>
          <TabsTrigger value="computer-labs" className="rounded-xl py-2 px-4 text-xs font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white hover:text-primary">
            Datasalar
          </TabsTrigger>
          <TabsTrigger value="ai-studies" className="rounded-xl py-2 px-4 text-xs font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white hover:text-primary">
            AI i studierna
          </TabsTrigger>
        </TabsList>

        {/* STUDY PLACES */}
        <TabsContent value="study-places" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-4">
            
            {/* Sidebar / Filter panel */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl p-4 space-y-4 sticky top-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Filter className="h-4 w-4 text-primary" />
                    Filtrera platser
                  </div>
                  {(searchQuery || selectedLocation !== "all" || selectedSoundLevel !== "all" || filterPentry || filterWifi || showSavedOnly) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Rensa allt
                    </Button>
                  )}
                </div>

                {/* Free text search */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Sök</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Sök namn, campus..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 rounded-xl bg-background/50 text-xs"
                    />
                  </div>
                </div>

                {/* Campus filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Område / Campus</Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="h-9 rounded-xl bg-background/50 text-xs">
                      <SelectValue placeholder="Alla områden" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {locations.map((loc) => (
                        <SelectItem key={loc} value={loc} className="text-xs rounded-lg">
                          {loc === "all" ? "Alla områden" : loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sound level filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Miljö & Ljudnivå</Label>
                  <Select value={selectedSoundLevel} onValueChange={setSelectedSoundLevel}>
                    <SelectTrigger className="h-9 rounded-xl bg-background/50 text-xs">
                      <SelectValue placeholder="Alla ljudnivåer" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs rounded-lg">Alla ljudnivåer</SelectItem>
                      <SelectItem value="Låg" className="text-xs rounded-lg">Låg ljudnivå</SelectItem>
                      <SelectItem value="Medellåg" className="text-xs rounded-lg">Medellåg ljudnivå</SelectItem>
                      <SelectItem value="Medel" className="text-xs rounded-lg">Medel ljudnivå</SelectItem>
                      <SelectItem value="Medelhög" className="text-xs rounded-lg">Medelhög ljudnivå</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="wifi-toggle" className="text-xs font-medium cursor-pointer">Kräv Wi-Fi</Label>
                    <Switch
                      id="wifi-toggle"
                      checked={filterWifi}
                      onCheckedChange={setFilterWifi}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="pentry-toggle" className="text-xs font-medium cursor-pointer">Kräv Pentry / Kök</Label>
                    <Switch
                      id="pentry-toggle"
                      checked={filterPentry}
                      onCheckedChange={setFilterPentry}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-1">
                    <Label htmlFor="saved-toggle" className="text-xs font-medium cursor-pointer flex items-center gap-1.5 text-sunset-orange">
                      <Heart className="h-3.5 w-3.5 fill-current" />
                      Mina sparade platser
                    </Label>
                    <Switch
                      id="saved-toggle"
                      checked={showSavedOnly}
                      onCheckedChange={setShowSavedOnly}
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Main view / Grid of cards */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Visar {filteredPlaces.length} av {STUDY_PLACES.length} studieplatser
                </div>
              </div>

              {filteredPlaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-16 text-center">
                  <Compass className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-foreground">Inga studieplatser hittades</p>
                  <p className="text-xs text-muted-foreground mt-1">Prova at ändra dina sök- eller filterinställningar.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 rounded-xl text-xs">
                    Återställ sökning
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredPlaces.map((place) => {
                    const isSaved = savedPlaces.includes(place.id);
                    return (
                      <Card key={place.id} className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl flex flex-col justify-between overflow-hidden relative group hover:shadow-lg transition-all duration-300">
                        
                        <CardHeader className="pb-3 relative">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors pr-6">
                                {place.name}
                              </CardTitle>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 text-primary/70" />
                                {place.location}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleSavePlace(place.id)}
                              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-background/80 transition-colors"
                            >
                              <Heart 
                                className={`h-4 w-4 transition-all ${isSaved ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground hover:text-foreground"}`}
                              />
                            </button>
                          </div>

                          {/* Rating and busy level */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <div className="flex items-center text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`h-3 w-3 ${i < place.rating ? "fill-current" : "text-border"}`} 
                                />
                              ))}
                            </div>
                            <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getBusyLevelColor(place.busyLevel)}`}>
                              Beläggning: {place.busyLevel}
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {place.description || "Ingen beskrivning angiven."}
                          </p>

                          {/* Facilities grid */}
                          <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <Wifi className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                              <span>Wi-Fi: {place.wifi ? "Ja" : "Nej"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <Coffee className="h-3.5 w-3.5 text-sunset-orange/70 shrink-0" />
                              <span>Pentry: {place.pentry ? "Ja" : "Nej"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground col-span-2">
                              <Plug className="h-3.5 w-3.5 text-purple-500/70 shrink-0" />
                              <span>Uttag: {place.powerOutlets}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground col-span-2">
                              <Volume2 className="h-3.5 w-3.5 text-emerald-500/70 shrink-0" />
                              <span>Ljudnivå: {place.soundLevel}</span>
                            </div>
                          </div>

                          {/* Opening Hours & external links */}
                          <div className="space-y-3 pt-2 border-t border-border/40 mt-auto">
                            <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 text-sunset-amber/70 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-semibold block text-foreground">Öppettider</span>
                                <span className="text-[9px] leading-tight">{place.hours}</span>
                              </div>
                            </div>

                            {place.links && place.links.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {place.links.map((link, idx) => (
                                  <a 
                                    key={idx}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[9px] font-semibold text-primary hover:text-sunset-orange bg-primary/5 hover:bg-primary/10 border border-primary/10 px-2 py-1 rounded-lg transition-colors"
                                  >
                                    {link.text}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>

                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </TabsContent>

        {/* METHODS */}
        <TabsContent value="methods" className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/60 bg-gradient-to-br from-purple-500/5 via-surface/60 to-surface/40 backdrop-blur-md rounded-2xl hover:border-purple-500/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 shadow-inner">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Pomodoro & Tidsblockering</CardTitle>
                <CardDescription className="text-[11px] text-purple-400/80 font-medium">Effektivisera din tid och behåll fokus</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 pt-2">
              <p className="leading-relaxed">
                <strong className="text-foreground">Pomodoro:</strong> Plugga fokuserat i 25 minuter, ta 5 minuters paus. Efter 4 cykler tar du en längre paus på 15-30 minuter. Använd timern här på StudieHubb för att hålla koll!
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Tidsblockering:</strong> Planera din dag i block (t.ex. 09-11: Skriva rapport, 13-15: Läsa kapitel 4) istället för en oändlig att göra-lista.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-emerald-500/5 via-surface/60 to-surface/40 backdrop-blur-md rounded-2xl hover:border-emerald-500/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 shadow-inner">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Aktiv återkallning (Active Recall)</CardTitle>
                <CardDescription className="text-[11px] text-emerald-400/80 font-medium">Förstå och minns informationen längre</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 pt-2">
              <p className="leading-relaxed">
                <strong className="text-foreground">Feynman-tekniken:</strong> Förklara ett svårt koncept med dina egna ord som om du förklarade det för ett barn. Då märker du direkt var dina kunskapsluckor finns.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Flashcards:</strong> Testa dig själv istället för att bara passivt läsa om anteckningarna. Det tvingar hjärnan att hämta informationen, vilket stärker minnesspåren.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GOOD ADVICE */}
        <TabsContent value="good-advice" className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/60 bg-gradient-to-br from-pink-500/5 via-surface/60 to-surface/40 backdrop-blur-md rounded-2xl hover:border-pink-500/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-2xl bg-pink-500/10 text-pink-400 shadow-inner">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Återhämtning & Sömn</CardTitle>
                <CardDescription className="text-[11px] text-pink-400/80 font-medium">Hjärnans viktigaste bränsle</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 pt-2">
              <p className="leading-relaxed">
                <strong className="text-foreground">Vikten av pauser:</strong> Att sitta 8 timmar i sträck ger sällan bra resultat. Hjärnan behöver pauser för att bearbeta det du lärt dig. Gå ut och ta luft i 10 minuter!
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Sömnen konsoliderar minnen:</strong> Det är under sömnen som dagens kunskap lagras i långtidsminnet. Att dygna innan en tenta är oftast kontraproduktivt.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-amber-500/5 via-surface/60 to-surface/40 backdrop-blur-md rounded-2xl hover:border-amber-500/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 shadow-inner">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Struktur och Realism</CardTitle>
                <CardDescription className="text-[11px] text-amber-400/80 font-medium">Sänk stressen med bra planering</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 pt-2">
              <p className="leading-relaxed">
                <strong className="text-foreground">Bryt ner uppgifter:</strong> En stor inlämning känns övermäktig. Dela upp den i delmoment (t.ex. "Skriv inledning", "Hitta 3 källor"). Det gör det mycket lättare att komma igång.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Var realistisk:</strong> Planera inte in 12 timmars plugg per dag. Sätt ett rimligt mål och sluta plugga med gott samvete när du uppnått det.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPUTER LABS */}
        <TabsContent value="computer-labs" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3 items-start">
            {/* Snabblänkar på vänster sida på större skärmar */}
            <div className="md:col-span-1 flex flex-col pt-1">
              <div className="flex items-start justify-between pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div className="pt-0.5">
                    <h3 className="text-lg font-bold text-foreground leading-none">Snabblänkar</h3>
                    <p className="text-[11px] text-muted-foreground mt-1.5">Dina sparade länkar</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-full"
                  onClick={() => setIsEditingLinks(!isEditingLinks)}
                >
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="space-y-4">
                {isEditingLinks && (
                  <div className="space-y-2 pb-4 border-b border-border/40 mb-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Titel</Label>
                      <Input 
                        placeholder="T.ex. Schema" 
                        value={newLinkTitle} 
                        onChange={(e) => setNewLinkTitle(e.target.value)} 
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">URL</Label>
                      <Input 
                        placeholder="https://..." 
                        value={newLinkUrl} 
                        onChange={(e) => setNewLinkUrl(e.target.value)} 
                        className="h-8 text-xs rounded-lg"
                        onKeyDown={(e) => e.key === 'Enter' && addQuickLink()}
                      />
                    </div>
                    <Button onClick={addQuickLink} className="w-full h-8 text-xs rounded-lg mt-2" disabled={!newLinkTitle || !newLinkUrl}>
                      <Plus className="h-3 w-3 mr-1" /> Lägg till länk
                    </Button>
                  </div>
                )}
                
                <div className="space-y-3">
                  {quickLinks.map((link, index) => {
                    const gradientClass = BUTTON_GRADIENTS[index % BUTTON_GRADIENTS.length];
                    return (
                      <div key={link.id} className="flex items-center gap-2 group w-full min-w-0">
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`w-full flex items-center justify-between gap-2.5 p-4 rounded-2xl ${gradientClass} font-bold text-sm shadow-md hover:shadow-lg transition-all group/link active:scale-[0.99] hover:-translate-y-0.5 min-w-0`}
                        >
                          <span className="whitespace-normal break-words text-left pr-2">{link.title}</span>
                          <ExternalLink className="h-4 w-4 shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                        </a>
                        {isEditingLinks && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-12 w-12 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-2xl shrink-0"
                            onClick={() => removeQuickLink(link.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {quickLinks.length === 0 && (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Inga snabblänkar tillagda ännu.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bilden på höger sida på större skärmar */}
            <div className="md:col-span-2">
              <button 
                className="rounded-2xl overflow-hidden cursor-zoom-in hover:brightness-95 active:scale-[0.99] transition-all w-full block text-left"
                onClick={() => setIsImageZoomed(true)}
              >
                <img 
                  src="/tipsguider/datorsalar.png" 
                  alt="Datorsalar" 
                  className="w-full h-auto block rounded-2xl border border-border/60 shadow-sm"
                />
              </button>
            </div>
          </div>

          {/* Fullskärmszoom-overlay */}
          {isImageZoomed && (
            <div 
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setIsImageZoomed(false)}
            >
              <img 
                src="/tipsguider/datorsalar.png" 
                alt="Datorsalar Zoomed" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
              />
              <button 
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 text-sm font-semibold transition-colors"
                onClick={() => setIsImageZoomed(false)}
              >
                Stäng
              </button>
            </div>
          )}
        </TabsContent>

        {/* AI IN STUDIES */}
        <TabsContent value="ai-studies" className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/60 bg-gradient-to-br from-orange-500/5 via-surface/60 to-surface/40 backdrop-blur-md rounded-2xl hover:border-orange-500/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-400 shadow-inner">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">AI som din personliga studiepartner</CardTitle>
                <CardDescription className="text-[11px] text-orange-400/80 font-medium">Effektiva sätt att använda AI-verktyg</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 pt-2">
              <p className="leading-relaxed">
                <strong className="text-foreground">Förklara komplex text:</strong> Klistra in en svår akademisk text och be AI att sammanfatta den eller förklara den med enklare ord och analogier.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Skapa övningsfrågor:</strong> Ge AI ditt kursmaterial och be den generera ett quiz eller 5 diskussionsfrågor för att testa dina kunskaper inför tentan.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-red-500/5 via-surface/60 to-surface/40 backdrop-blur-md rounded-2xl hover:border-red-500/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-400 shadow-inner">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Källkritik & Akademisk hederlighet</CardTitle>
                <CardDescription className="text-[11px] text-red-400/80 font-medium">Använd AI ansvarsfullt</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 pt-2">
              <p className="leading-relaxed">
                <strong className="text-foreground">Hallucinationer:</strong> AI-modeller kan hitta på fakta eller källhänvisningar. Dubbelkolla ALLTID viktig information och faktiska källor mot kurslitteraturen.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Fusk vs. Stöd:</strong> Använd AI för att bolla idéer, förbättra ditt språk eller förstå koncept. Låt aldrig AI skriva dina inlämningar åt dig – det klassas som plagiat och kan leda till avstängning.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
