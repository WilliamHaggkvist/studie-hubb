import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "already" }
  | { kind: "confirm" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const token =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok || json.error) {
          setState({ kind: "invalid" });
          return;
        }
        if (json.valid === false && json.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        if (json.valid) {
          setState({ kind: "confirm" });
          return;
        }
        setState({ kind: "invalid" });
      } catch {
        setState({ kind: "invalid" });
      }
    })();
  }, [token]);

  async function confirm() {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (json.success) setState({ kind: "success" });
      else if (json.reason === "already_unsubscribed") setState({ kind: "already" });
      else setState({ kind: "error", message: json.error ?? "Något gick fel" });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Fel" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-surface/60 p-8 text-center shadow-lg backdrop-blur-md">
        <h1 className="font-display text-3xl font-bold gradient-text">StudieHubb</h1>
        {state.kind === "loading" && (
          <p className="mt-6 text-sm text-muted-foreground">Kontrollerar länken…</p>
        )}
        {state.kind === "invalid" && (
          <>
            <h2 className="mt-6 text-xl font-semibold">Ogiltig länk</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Denna avanmälningslänk är ogiltig eller har gått ut.
            </p>
          </>
        )}
        {state.kind === "already" && (
          <>
            <h2 className="mt-6 text-xl font-semibold">Redan avanmäld</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Denna e-postadress får redan inga mejl från oss.
            </p>
          </>
        )}
        {state.kind === "confirm" && (
          <>
            <h2 className="mt-6 text-xl font-semibold">Vill du avanmäla dig?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Du kommer inte längre att få påminnelser eller sammanfattningar från StudieHubb.
            </p>
            <button
              onClick={confirm}
              className="mt-6 inline-flex items-center justify-center rounded-md gradient-sunset px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Bekräfta avanmälan
            </button>
          </>
        )}
        {state.kind === "submitting" && (
          <p className="mt-6 text-sm text-muted-foreground">Avanmäler…</p>
        )}
        {state.kind === "success" && (
          <>
            <h2 className="mt-6 text-xl font-semibold">Du är avanmäld</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Du kommer inte längre att få mejl från StudieHubb.
            </p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <h2 className="mt-6 text-xl font-semibold">Fel</h2>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
          </>
        )}
      </div>
    </div>
  );
}
