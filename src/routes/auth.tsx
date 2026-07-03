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

// Koden är den enda identifieraren. Vi mappar den till en intern e-post +
// lösenord som Supabase kräver bakom kulisserna.
const EMAIL_DOMAIN = "studyos.local";
const PW_SALT = "-studyos-code";
const MIN_CODE_LENGTH = 6;

function normalizeCode(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
function toEmail(code: string) {
  return `code-${normalizeCode(code)}@${EMAIL_DOMAIN}`;
}
function toInternalPassword(code: string) {
  return `${normalizeCode(code)}${PW_SALT}`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signInCode, setSignInCode] = useState("");
  const [signUpCode, setSignUpCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(signInCode);
    if (code.length < MIN_CODE_LENGTH) {
      return toast.error(`Koden måste vara minst ${MIN_CODE_LENGTH} tecken.`);
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(code),
      password: toInternalPassword(code),
    });
    setLoading(false);
    if (error) return toast.error("Felaktig kod");
    toast.success("Välkommen tillbaka");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(signUpCode);
    if (code.length < MIN_CODE_LENGTH) {
      return toast.error(`Koden måste vara minst ${MIN_CODE_LENGTH} tecken (bokstäver och siffror).`);
    }
    if (normalizeCode(confirmCode) !== code) {
      return toast.error("Koderna matchar inte.");
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: toEmail(code),
      password: toInternalPassword(code),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: name.trim() || `Användare` },
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("already") || error.message.toLowerCase().includes("registered")) {
        return toast.error("Den koden är redan tagen — välj en annan.");
      }
      return toast.error(error.message);
    }
    toast.success("Konto skapat – spara din kod!");
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
            <CardDescription>Personlig arbetsyta — logga in med din kod.</CardDescription>
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
                    <Label htmlFor="si-code">Kod</Label>
                    <Input
                      id="si-code"
                      type="password"
                      value={signInCode}
                      onChange={(e) => setSignInCode(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="Din personliga kod"
                    />
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
                    <Label htmlFor="su-code">Välj en kod</Label>
                    <Input
                      id="su-code"
                      type="password"
                      value={signUpCode}
                      onChange={(e) => setSignUpCode(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Minst 6 tecken (a–z, 0–9)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-code-confirm">Bekräfta koden</Label>
                    <Input
                      id="su-code-confirm"
                      type="password"
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Skriv koden igen"
                    />
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    ⚠️ Spara koden på ett säkert ställe. Tappar du bort den kan du <strong>inte</strong> återställa kontot — all data försvinner.
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
