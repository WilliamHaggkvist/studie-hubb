import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

interface LectureData {
  title: string;
  innehall: string;
  litteratur: string;
}

const lectures: LectureData[] = [
  {
    title: "F1",
    innehall: "Sannolikhetsteorins grunder (Grundläggande terminologi, mängdlära, Kolmogorovs axiom, konstruktion av sannolikhetsmått, kombinatorik)",
    litteratur: "Kapitel 2.1-2.5"
  },
  {
    title: "F2",
    innehall: "Sannolikhetsteorins grunder (forts.) (Kombinatorik, betingade sannolikheter, oberoende händelser)",
    litteratur: "Kapitel 2.5-2.9"
  },
  {
    title: "F3",
    innehall: "Stokastiska variabler (Diskreta stokastiska variabler, exempel på fördelningar)",
    litteratur: "Kapitel 3.1-3.4"
  },
  {
    title: "F4",
    innehall: "Stokastiska variabler (Kontinuerliga stokastiska variabler, exempel på fördelningar)",
    litteratur: "Kapitel 3.5-3.9"
  },
  {
    title: "F5",
    innehall: "Funktioner av stokastiska variabler. Flerdimensionella stokastiska variabler, sannolikhetsfunktioner och täthetsfunktioner. Marginell sannolikhets- och täthetsfunktion. Oberoende s.v. Maximum och minimum av s.v. Fördelning för summa av oberoende s.v.",
    litteratur: "Kapitel 3.10, 4.1-4.7"
  },
  {
    title: "F6",
    innehall: "Definitioner, väntevärde och varians dvs läges- och spridningsmått. Väntevärden av funktion av flerdimensionell s.v. Kovarians och korrelation. Linjäritet och bilinjäritet hos väntevärde resp. kovarians. Stora talens lag.",
    litteratur: "Kapitel 5.1-5.4"
  },
  {
    title: "F7",
    innehall: "Linjäritet och bilinjäritet hos väntevärde resp. kovarians. Stora talens lag. Normalfördelningen. Linjärkombinationer av oberoende normalfördelade s.v. Centrala gränsvärdessatsen.",
    litteratur: "Kapitel 5.5-5.6, 6.1-6.4"
  },
  {
    title: "F8",
    innehall: "Linjärkombinationer av oberoende normalfördelade s.v. Centrala gränsvärdessatsen. Binomialfördelningen och dess släktingar. Approximationer.",
    litteratur: "Kapitel 6.5 fram t.o.m. sid 153, 6.7, 7.1-7.4"
  },
  {
    title: "F9",
    innehall: "Beskrivande statistik. Lägesmått, spridningsmått och korrelation. Definition av punktskattning. Skattning av väntevärde och varians. Minsta kvadrat- och maximum likelihood-metoderna för punktskattning.",
    litteratur: "Kapitel 10.1-10.4, 11.1-11.4"
  },
  {
    title: "F10",
    innehall: "Minsta kvadrat- och Maximum likelihood-metoderna för punktskattning. Definition av begreppen väntevärdesriktighet, konsistens, effektivitet och medelfel.",
    litteratur: "Kapitel 11.5-11.9, 12.1-12.3a"
  },
  {
    title: "F11",
    innehall: "Definition av begreppet konfidensintervall. Exempel i situationer med normalfördelade data: intervall för väntevärde när standardavvikelsen är känd resp. okänd samt approximativa intervall. Konfidensintervall för normalfördelade data: varians, differens mellan väntevärden (\"två stickprov\"). Även situationen \"stickprov i par\". Konfidensintervall mha normalapproximation.",
    litteratur: "Kapitel 12.1-12.3a, 12.3b-12.5"
  },
  {
    title: "F12",
    innehall: "Konfidensintervall för normalfördelade data: varians, differens mellan väntevärden (\"två stickprov\"). Även situationen \"stickprov i par\". Konfidensintervall mha normalapproximation. Felfortplantning. Introduktion till hypotesprövning; p-värde. Test för parametrar i normalfördelning.",
    litteratur: "Kapitel 12.3b-12.5, 11.10"
  },
  {
    title: "F13",
    innehall: "Introduktion till hypotesprövning; p-värde. Test för parametrar i normalfördelning. Styrkefunktion. Test baserade på normalapproximation. Invertering av test till konfidensintervall (konfidensmetoden).",
    litteratur: "Kapitel 13.1-13.3, 13.6, 13.4-13.5, 13.7-13.8"
  },
  {
    title: "F14",
    innehall: "Fortsättning av hypotesprövning. Styrkefunktion. Test baserade på normalapproximation. Invertering av test till konfidensintervall (konfidensmetoden). Enkel linjär regression: punkt- och intervallskattning av parametrar. Modellvalidering mha residualanalys. Något om multipel linjär regression.",
    litteratur: "Kapitel 13.1-13.3, 13.6, 13.4-13.5, 13.7-13.8, 14.1-14.4"
  },
  {
    title: "F15",
    innehall: "Chi2-test: test av fix nollhypotes, nollhypotes med skattade parametrar, homogenitetstest och test av oberoende.",
    litteratur: "Kapitel 13.10"
  }
];

async function main() {
  const passcode = "550155";
  const email = `code-${passcode}@studyos.local`;
  const password = `${passcode}-studyos-code`;

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.error("Auth failed:", authError);
    return;
  }

  const userId = authData.user.id;
  console.log("Logged in user:", userId);

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId);

  const sf1916 = courses?.find(c => c.code?.includes("SF1916") || c.name?.includes("SF1916"));
  if (!sf1916) {
    console.error("SF1916 course not found!");
    return;
  }

  console.log("Found SF1916 course ID:", sf1916.id);

  const tasksToInsert = lectures.map((lec, index) => ({
    course_id: sf1916.id,
    user_id: userId,
    title: lec.title,
    description: `Innehåll: ${lec.innehall}\nLitteratur: ${lec.litteratur}`,
    task_type: "annat",
    status: "todo",
    priority: "medium",
    due_at: null,
    sort_order: index + 1
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("tasks")
    .insert(tasksToInsert)
    .select();

  if (insertError) {
    console.error("Error inserting tasks:", insertError);
    return;
  }

  console.log(`Successfully inserted ${inserted.length} lecture tasks (F1-F15) for SF1916!`);
}

main();
