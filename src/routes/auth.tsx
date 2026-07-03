import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      if (data.session) throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

// Username → internal email/password mapping so Supabase (which requires an email
// + min-6-char password) can back a simple username + PIN login for personal use.
const EMAIL_DOMAIN = "studyos.local";
const PW_SALT = "-studyos-pin";

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
}
function toEmail(username: string) {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
}
function toInternalPassword(pin: string) {
  return `${pin}${PW_SALT}`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  function validate(): string | null {
    const u = normalizeUsername(username);
    if (u.length < 2) return "Ange ett användarnamn (minst 2 tecken).";
    if (pin.length < 1) return "Ange en kod.";
    return null;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password: toInternalPassword(pin),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Välkommen tillbaka");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: toEmail(username),
      password: toInternalPassword(pin),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: name || normalizeUsername(username) },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Konto skapat – du är inloggad");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-sunset-coral/20 blur-3xl" />
        <div className="absolute top-1/2 -right-32 h-96 w-96 rounded-full bg-sunset-violet/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-sunset-amber/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-sunset-amber" />
            Din studiearbetsyta
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight">
            <span className="gradient-text">StudyOS</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Sidor, kurser, uppgifter, kalender och tidsstatistik — allt organiserat på ett ställe.
          </p>
        </div>

        <Card className="w-full max-w-md border-border/60 bg-surface/70 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-display">Kom igång</CardTitle>
            <CardDescription>Personlig arbetsyta — logga in med användarnamn och kod.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Logga in</TabsTrigger>
                <TabsTrigger value="signup">Skapa konto</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="si-user">Användarnamn</Label>
                    <Input id="si-user" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" placeholder="t.ex. anna" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-pin">Kod</Label>
                    <Input id="si-pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} required autoComplete="current-password" placeholder="t.ex. 1234" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full gradient-sunset text-white hover:opacity-90">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Logga in
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Namn (visas i appen)</Label>
                    <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-user">Användarnamn</Label>
                    <Input id="su-user" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" placeholder="t.ex. anna" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pin">Kod</Label>
                    <Input id="su-pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} required autoComplete="new-password" placeholder="t.ex. 1234" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full gradient-sunset text-white hover:opacity-90">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Skapa konto
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Personlig arbetsyta — ingen e-post krävs.{" "}
              <Link to="/" className="underline hover:text-foreground">Startsida</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
