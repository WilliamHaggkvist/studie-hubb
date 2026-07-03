import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";
import { useUniversities, useUserSettings } from "@/lib/settings";
import { ARSKURS_OPTIONS } from "@/lib/course-presets";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type TermRow = { id: string; year: number; term: "host" | "var" | "sommar"; start_date: string; end_date: string };

function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Inställningar</h1>
        <p className="text-sm text-muted-foreground">Anpassa StudyOS efter dina studier.</p>
      </div>
      <ProfileCard />
      <StudySettingsCard />
      <UniversitiesCard />
      <TermsCard />
      <GoogleCard />
    </div>
  );
}

function ProfileCard() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("display_name").eq("id", u.user.id).maybeSingle();
      setName(data?.display_name ?? "");
      setLoaded(true);
    })();
  }, []);
  async function save() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || null }).eq("id", u.user.id);
    if (error) toast.error(error.message);
    else { toast.success("Sparat"); qc.invalidateQueries({ queryKey: ["profile"] }); }
  }
  return (
    <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
      <CardHeader><CardTitle className="font-display text-base">Profil</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5"><Label>Visningsnamn</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!loaded} className="rounded-xl" />
        </div>
        <Button size="sm" className="gap-1 rounded-xl" onClick={save}><Save className="h-3.5 w-3.5" /> Spara</Button>
      </CardContent>
    </Card>
  );
}

function StudySettingsCard() {
  const { data: s } = useUserSettings();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (patch: { current_year?: number; density?: string; translucent?: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error } = await supabase.from("user_settings").update(patch).eq("user_id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_settings"] }),
  });
  return (
    <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
      <CardHeader><CardTitle className="font-display text-base">Studier & utseende</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Aktuell årskurs</Label>
            <Select value={String(s?.current_year ?? 1)} onValueChange={(v) => save.mutate({ current_year: Number(v) })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{ARSKURS_OPTIONS.map((a) => <SelectItem key={a} value={String(a)}>Årskurs {a}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Styr vilka kurser som visas som "aktiva" på översikten.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Densitet</Label>
            <Select value={s?.density ?? "comfortable"} onValueChange={(v) => save.mutate({ density: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Bekväm</SelectItem>
                <SelectItem value="compact">Kompakt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <div>
            <div className="text-sm font-medium">Translucent design</div>
            <div className="text-[11px] text-muted-foreground">Frostade paneler med lätt oskärpa.</div>
          </div>
          <Switch checked={!!s?.translucent} onCheckedChange={(v) => save.mutate({ translucent: v })} />
        </div>
      </CardContent>
    </Card>
  );
}

function UniversitiesCard() {
  const { data: unis = [] } = useUniversities();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error } = await supabase.from("universities").insert({ user_id: u.user.id, name: newName.trim(), sort_order: unis.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => { setNewName(""); qc.invalidateQueries({ queryKey: ["universities"] }); toast.success("Tillagt"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });
  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("universities").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["universities"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("universities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["universities"] }),
  });
  return (
    <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
      <CardHeader><CardTitle className="font-display text-base">Universitet</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {unis.map((u) => (
          <div key={u.id} className="flex items-center gap-2">
            <Input defaultValue={u.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== u.name) rename.mutate({ id: u.id, name: e.target.value.trim() }); }} className="rounded-xl" />
            <Button size="icon" variant="ghost" className="rounded-xl text-destructive" onClick={() => { if (confirm(`Ta bort ${u.name}?`)) del.mutate(u.id); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
          <Input placeholder="Lägg till universitet…" value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-xl" />
          <Button size="sm" className="gap-1 rounded-xl" disabled={!newName.trim() || add.isPending} onClick={() => add.mutate()}><Plus className="h-3.5 w-3.5" /> Lägg till</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TermsCard() {
  const qc = useQueryClient();
  const { data: terms = [] } = useQuery({
    queryKey: ["term_dates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("term_dates").select("id,year,term,start_date,end_date").order("year", { ascending: false }).order("term");
      if (error) throw error;
      return (data ?? []) as TermRow[];
    },
  });
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [term, setTerm] = useState<"host" | "var" | "sommar">("host");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const upsert = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error } = await supabase.from("term_dates").upsert({
        user_id: u.user.id, year: Number(year), term, start_date: start, end_date: end,
      }, { onConflict: "user_id,year,term" });
      if (error) throw error;
    },
    onSuccess: () => { setStart(""); setEnd(""); qc.invalidateQueries({ queryKey: ["term_dates"] }); toast.success("Sparat"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("term_dates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["term_dates"] }),
  });

  const termName = (t: string) => t === "host" ? "Höst" : t === "var" ? "Vår" : "Sommar";

  return (
    <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
      <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><CalIcon className="h-4 w-4" /> Terminsdatum</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {terms.length === 0 && <div className="text-xs text-muted-foreground">Inga terminer inlagda än.</div>}
          {terms.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm">
              <span className="font-medium">{termName(t.term)} {t.year}</span>
              <span className="text-muted-foreground text-xs">{t.start_date} → {t.end_date}</span>
              <Button size="icon" variant="ghost" className="ml-auto rounded-xl text-destructive" onClick={() => del.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-5 items-end pt-3 border-t border-border/60">
          <div className="space-y-1"><Label className="text-xs">År</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="rounded-xl" /></div>
          <div className="space-y-1"><Label className="text-xs">Termin</Label>
            <Select value={term} onValueChange={(v) => setTerm(v as "host" | "var" | "sommar")}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="host">Höst</SelectItem>
                <SelectItem value="var">Vår</SelectItem>
                <SelectItem value="sommar">Sommar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl" /></div>
          <div className="space-y-1"><Label className="text-xs">Slut</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl" /></div>
          <Button size="sm" className="rounded-xl" disabled={!start || !end || upsert.isPending} onClick={() => upsert.mutate()}>Spara</Button>
        </div>
      </CardContent>
    </Card>
  );
}

type CalPref = {
  id: string;
  google_calendar_id: string;
  name: string;
  background_color: string | null;
  sync_enabled: boolean;
  counts_as_study: boolean;
};

function GoogleCard() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<{
    imported: number;
    sessions: number;
    mapped: number;
    unmapped: number;
    calendars: number;
    total: number;
  } | null>(null);
  const [calendars, setCalendars] = useState<CalPref[] | null>(null);

  // Ladda befintliga prefs direkt (utan att röra Google)
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("google_calendar_prefs")
        .select("id, google_calendar_id, name, background_color, sync_enabled, counts_as_study")
        .eq("user_id", u.user.id)
        .order("name");
      if (data) setCalendars(data as CalPref[]);
    })();
  }, []);

  const fetchCalendars = useMutation({
    mutationFn: async () => {
      const { listGoogleCalendars } = await import("@/lib/google-calendar.functions");
      return await listGoogleCalendars();
    },
    onSuccess: (r) => {
      setCalendars(r.calendars as CalPref[]);
      toast.success(`Hittade ${r.calendars.length} kalendrar`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const togglePref = useMutation({
    mutationFn: async (input: {
      id: string;
      sync_enabled?: boolean;
      counts_as_study?: boolean;
    }) => {
      const { updateCalendarPref } = await import("@/lib/google-calendar.functions");
      return await updateCalendarPref({ data: input });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  function updateLocal(id: string, patch: Partial<CalPref>) {
    setCalendars((prev) =>
      prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } : c)) : prev,
    );
  }

  const sync = useMutation({
    mutationFn: async () => {
      const { syncGoogleCalendar } = await import("@/lib/google-calendar.functions");
      return await syncGoogleCalendar();
    },
    onSuccess: (r) => {
      setStatus(r);
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(
        `Synkat ${r.calendars} kalender(-rar): ${r.imported} händelser, ${r.sessions} studiepass`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Synkfel"),
  });

  return (
    <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2">
          <CalIcon className="h-4 w-4" /> Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
          <p>
            Skriv <code className="rounded bg-surface px-1">[KURSKOD]</code> i eventtiteln
            (t.ex. <code className="rounded bg-surface px-1">[SG1140] Föreläsning kap 3</code>)
            så kopplas eventet automatiskt till rätt kurs.
          </p>
          <p>
            Kurskoderna hämtas från fältet <em>Kurskod</em> på respektive kurs. Prefix
            <code className="rounded bg-surface px-1">[Studiepass]</code> skapar ett studiepass
            istället för ett event.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Kalendrar
            </Label>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => fetchCalendars.mutate()}
              disabled={fetchCalendars.isPending}
            >
              {fetchCalendars.isPending ? "Hämtar…" : calendars ? "Uppdatera lista" : "Hämta kalendrar"}
            </Button>
          </div>
          {calendars && calendars.length === 0 && (
            <div className="text-xs text-muted-foreground">Inga kalendrar hittades.</div>
          )}
          {calendars && calendars.length > 0 && (
            <div className="rounded-xl border border-border/60 divide-y divide-border/60 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground bg-background/30">
                <span>Namn</span>
                <span className="text-center w-16">Synka</span>
                <span className="text-center w-16">Studietid</span>
              </div>
              {calendars.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full border border-border/60 shrink-0"
                      style={{ background: c.background_color ?? "#94a3b8" }}
                    />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="w-16 flex justify-center">
                    <Switch
                      checked={c.sync_enabled}
                      onCheckedChange={(v) => {
                        updateLocal(c.id, { sync_enabled: v });
                        togglePref.mutate({ id: c.id, sync_enabled: v });
                      }}
                    />
                  </div>
                  <div className="w-16 flex justify-center">
                    <Switch
                      checked={c.counts_as_study}
                      onCheckedChange={(v) => {
                        updateLocal(c.id, { counts_as_study: v });
                        togglePref.mutate({ id: c.id, counts_as_study: v });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <Button
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="gap-1 rounded-xl gradient-sunset text-white hover:opacity-90"
          >
            {sync.isPending ? "Synkar…" : "Synka nu"}
          </Button>
          {status && (
            <div className="text-xs text-muted-foreground">
              {status.imported} händelser · {status.mapped} kopplade · {status.unmapped} okopplade · {status.sessions} studiepass · {status.calendars} kalender(-rar)
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
