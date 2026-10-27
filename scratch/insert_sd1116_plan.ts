import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

interface ActivityItem {
  title: string;
  task_type: "annat" | "ovning" | "seminarie" | "kontrollskrivning" | "tenta" | "quiz";
  task_kind: "task" | "exam";
  due_at: string | null; // ISO string
  description: string;
  quiz?: {
    title: string;
    due_at: string;
    description: string;
  };
}

const activities: ActivityItem[] = [
  // F1
  {
    title: "Föreläsning 1",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-10-26T13:00:00+01:00",
    description: [
      "Sal: D2 (kl 13-15)",
      "",
      "Aktivitet & Lärobok:",
      "• Kursinformation (Lärobok: -)",
      "• Varför läsa kurs om ljud och vibrationer? (Lärobok: Inledning: sid i-ix)",
      "• Vad är ljud och vibrationer? (Lärobok: Inledning och kapitel 1, speciellt avsnitt 1.2)",
      "• Några viktiga storheter och begrepp (Lärobok: Kapitel 1, speciellt 1.2-1.5.1)",
      "• Styrkemått för ljud och vibrationer (Lärobok: Kapitel 1, speciellt 1.3 och 1.10)"
    ].join("\n")
  },

  // F2
  {
    title: "Föreläsning 2",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-10-27T10:00:00+01:00",
    description: [
      "Sal: D2 (kl 10-12)",
      "",
      "Aktivitet & Lärobok:",
      "• Gäst från näringslivet (Romain Haettel, Atlas Copco)",
      "• Summation av flera bidrag (Lärobok: Kapitel 1, speciellt 1.12 och 1.13)",
      "• Longitudinella och transversella vågor (Lärobok: Kapitel 1, speciellt 1.2, 1.5 och 1.8)",
      "• Plana vågor (Lärobok: Kapitel 1, speciellt 1.5.1)",
      "• Sfäriska vågor (Lärobok: Kapitel 1, speciellt 1.5.2)"
    ].join("\n"),
    quiz: {
      title: "Quiz 1 - Summation av bidrag",
      due_at: "2026-10-26T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 2: Quiz 1 - Summation av bidrag. Lämnas in innan föreläsningen.\nLänk: https://canvas.kth.se/courses/65466/quizzes/76667"
    }
  },

  // Övning 1
  {
    title: "Övning 1",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-10-27T13:00:00+01:00",
    description: [
      "Sal: Q33 och Q34 (kl 13-15)",
      "",
      "Tema & Uppgifter:",
      "• Styrkemått (Uppgifter: 1:11, 1:15, 1:13, 1:16)",
      "• Frekvensspektrum (Uppgifter: 1:11)",
      "• Summation av bidrag (Uppgifter: 1:15, 1:13)",
      "• Lokalt plan sfärisk våg (Uppgifter: 1:16)"
    ].join("\n")
  },

  // F3
  {
    title: "Föreläsning 3",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-10-30T08:00:00+01:00",
    description: [
      "Sal: D2 (kl 8-10)",
      "",
      "Aktivitet & Lärobok:",
      "• Frekvensspektrum-Frekvensband-Oktavband-Tersband (Lärobok: Kapitel 1, speciellt 1.9, 1.11 och 1.13)",
      "• Ljud o vibrationers påverkan på människan (Lärobok: Kapitel 2 utom 2.3.4-2.3.5 och 2.4.2-2.4.5)",
      "• Frekvensvägning (Lärobok: Kapitel 2: 2.1.2, 2.1.3, 2.3.2 och 2.3.3)",
      "• Ljudkvalitét (Lärobok: Kapitel 2: 2.1.8)",
      "• Hand-arm-vibrationer, bedömning av skaderisk (Lärobok: Kapitel 2: 2.3.3)",
      "• Om tid finns: Komplexa storheter (Lärobok: Nya kapitel 3: 3.1 och 3.2)"
    ].join("\n"),
    quiz: {
      title: "Quiz 2 - Frekvensspektrum",
      due_at: "2026-10-29T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 3: Quiz 2 - Frekvensspektrum. Lämnas in innan föreläsningen.\nLänk: https://play.kth.se/media/Frekvensspektrum/0_p5xueroy"
    }
  },

  // Övning 2
  {
    title: "Övning 2",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-10-31T10:00:00+01:00",
    description: [
      "Sal: Q34 och Q36 (kl 10-12)",
      "",
      "Tema & Uppgifter:",
      "• Summation i frekvensspektrum (Uppgifter: 2.1, 2:3)",
      "• Bullerstörningsmått: A-vägning (Uppgifter: 2:1, 2:3)",
      "• Hand-armvibrationer bedömning av skaderisk (Uppgifter: 2:7, 2:8)"
    ].join("\n")
  },

  // F4
  {
    title: "Föreläsning 4",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-11-02T13:00:00+01:00",
    description: [
      "Sal: D2 (kl 13-15)",
      "",
      "Aktivitet & Lärobok:",
      "• Ev: Komplexa storheter (Lärobok: Nya kapitel 3: 3.1 och 3.2)",
      "• Linjära system (Lärobok: Nya kapitel 3: 3.3)",
      "• Frekvenssvarsfunktioner (Lärobok: Nya kapitel 3: 3.4)",
      "• Frekvenssvarsfunktioner: 1-frihetsgradssystemet (Lärobok: Nya kapitel 3: 3.5)",
      "• Förluster - Dämpning - Förlustfaktor (Lärobok: Nya kapitel 3: 3.5)",
      "• Komplex fjäderkonstant (Lärobok: Nya kapitel 3: 3.8)",
      "• Egenfrekvens (Lärobok: Nya kapitel 3: 3.6)",
      "• Resonans, resonansfrekvens (Lärobok: Nya kapitel 3: 3.6)"
    ].join("\n"),
    quiz: {
      title: "Quiz 3 - Linjära system och frekvenssvar",
      due_at: "2026-11-01T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 4: Quiz 3 - Linjära system och frekvenssvar. Lämnas in innan föreläsningen.\nLänk: https://canvas.kth.se/courses/65466/assignments/395135"
    }
  },

  // Övning 3
  {
    title: "Övning 3",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-11-02T15:00:00+01:00",
    description: [
      "Sal: Q34 och Q36 (kl 15-17)",
      "",
      "Tema & Uppgifter:",
      "• Komplexa storheter (Uppgifter: 3:3)",
      "• Frekvenssvarsfunktion i diagramform (Uppgifter: 3:11)",
      "• Frekvenssvarsfunktion: 1-frihetsgradssystemet (Uppgifter: 3:13, 3:14)",
      "• Förluster - Komplex fjäderkonstant (Uppgifter: 3:13, 3:14)"
    ].join("\n")
  },

  // F5
  {
    title: "Föreläsning 5",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-11-05T14:00:00+01:00",
    description: [
      "Sal: K2 [Observera ny sal!] (kl 14-16)",
      "",
      "Aktivitet & Lärobok:",
      "• Dissipation, förluster och förlustfaktor (Lärobok: Nya kapitel 3: 3.8)",
      "• Fler-frihetsgradssystem (Lärobok: Nya kapitel 3: 3.5.2 och 3.5.3)",
      "• Fourierserieutveckling - Linjespektrum (Lärobok: Nya kapitel 3: 3.9-3.9.2)",
      "• Fouriertransformering - Frekvensspektrum (Lärobok: Nya kapitel 3: 3.9.3)"
    ].join("\n"),
    quiz: {
      title: "Quiz 4 - Att bestämma frekvensspektrum",
      due_at: "2026-11-04T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 5: Quiz 4 - Att bestämma frekvensspektrum. Lämnas in innan föreläsningen.\nLänk: https://canvas.kth.se/courses/65466/quizzes/76670"
    }
  },

  // Övning 4
  {
    title: "Övning 4",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-11-06T15:00:00+01:00",
    description: [
      "Sal: Q34, Q36 [Ny tid] [Flyttad från Torsdagen den 5 november, kl 16-18] (kl 15-17)",
      "",
      "Tema & Uppgifter:",
      "• Frekvensspektrum periodiska signaler - Fourierserie (Uppgifter: 3:20, 3:21)",
      "• Massa-fjäder-dämparsystem (Uppgifter: 3:25)"
    ].join("\n")
  },

  // F6
  {
    title: "Föreläsning 6",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-11-09T08:00:00+01:00",
    description: [
      "Sal: D2 (kl 8-10)",
      "",
      "Aktivitet & Lärobok:",
      "• Akustiska vågekvationen (Lärobok: Kapitel 4: 4.1)",
      "• Plana ljudvågor (Lärobok: Kapitel 4: 4.2.1-4.2.3)",
      "• Ljudtryck-Partikelhastighet-Specifik impedans (Lärobok: Kapitel 4: 4.2.2 och 4.2.3)",
      "• Energitransport i plan ljudvåg (Lärobok: Kapitel 4: 4.2.3)",
      "• Vågutbredning i rör (Lärobok: Kapitel 4: 4.2.2)",
      "• Rand- och kopplingsvillkor i rör (Lärobok: Kapitel 5: 5.1.1)",
      "• Areaförändringar i rör (Lärobok: Kapitel 5: 5.1.2)"
    ].join("\n"),
    quiz: {
      title: "Quiz 5 - Linjära akustiska vågekvationen",
      due_at: "2026-11-08T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 6: Quiz 5 - Linjära akustiska vågekvationen. Lämnas in innan föreläsningen.\nLänk: https://canvas.kth.se/courses/65466/quizzes/76631"
    }
  },

  // Övning 5
  {
    title: "Övning 5",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-11-09T10:00:00+01:00",
    description: [
      "Sal: Q33, Q34 (kl 10-12)",
      "",
      "Tema & Uppgifter:",
      "• Plana vågor, plana vågor i rör (Uppgifter: 4:3, 4:6, 5:2 och 5:3)",
      "• Rand- och kopplingsvillkor plana vågor (Uppgifter: 5:2, 5:3)",
      "• Förluster i medier - Komplex kompressionsmodul (Uppgifter: 4:6)"
    ].join("\n")
  },

  // Seminarium 1
  {
    title: "Seminarium 1",
    task_type: "seminarie",
    task_kind: "exam",
    due_at: "2026-11-10T13:00:00+01:00",
    description: "Sal: Q34 och Q36 (kl 13-14)\n\nAktivitet:\n• Seminarium 1"
  },

  // Förberedelse Teori-KS1
  {
    title: "Förberedelse Teori-KS1",
    task_type: "ovning",
    task_kind: "task",
    due_at: "2026-11-10T14:00:00+01:00",
    description: "Sal: Q34 och Q36 (kl 14-15)\n\nAktivitet:\n• Förberedelse Teori-KS1"
  },

  // F7
  {
    title: "Föreläsning 7",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-11-12T13:00:00+01:00",
    description: [
      "Sal: D2 (kl 13-15)",
      "",
      "Aktivitet & Lärobok:",
      "• Sfäriska ljudvågor (Lärobok: Kapitel 4: 4.2.5 och 4.2.6)",
      "• Ljudtryck-Partikelhastighet-Specifik impedans (Lärobok: Kapitel 4: 4.2.6)",
      "• Akustisk monopol - Akustisk dipol (Lärobok: Kapitel 8: 8.1 och 8.2)"
    ].join("\n"),
    quiz: {
      title: "Quiz 6 - Sfäriska ljudvågor",
      due_at: "2026-11-11T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 7: Quiz 6 - Sfäriska ljudvågor. Lämnas in innan föreläsningen.\nLänk: https://canvas.kth.se/courses/65466/quizzes/76668"
    }
  },

  // Övning 6
  {
    title: "Övning 6",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-11-13T08:00:00+01:00",
    description: [
      "Sal: V23, V33 [Ny tid] [Flyttad från Torsdag 12 november, kl 15-17] (kl 8-10)",
      "",
      "Tema & Uppgifter:",
      "• Sfäriska ljudvågor (Uppgifter: 4:9, 4:11)",
      "• Ljudeffekt sfärisk ljudvåg (Uppgifter: 4:9, 4:11)",
      "• Akustisk monopol (Uppgifter: 8:6, 8:8)"
    ].join("\n")
  },

  // Kontrollskrivning 1
  {
    title: "Kontrollskrivning 1",
    task_type: "kontrollskrivning",
    task_kind: "exam",
    due_at: "2026-11-13T13:00:00+01:00",
    description: "Kontrollskrivning 1 (kl 13.00-15.00)"
  },

  // F8
  {
    title: "Föreläsning 8",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-11-17T13:00:00+01:00",
    description: [
      "Sal: D2 (kl 13-15)",
      "",
      "Aktivitet & Lärobok:",
      "• Stående vågor-Akustiska rumsmoder (Lärobok: Kapitel 5: 5.1.1, 5.1.2, 5.1.3 och 5.2)",
      "• Blåsinstrument (Lärobok: -)",
      "• Vågekvationer: Stänger, axlar och balkar (Lärobok: Kapitel 6: 6.1-6.3.4, 6.4 och 6.5-6.5.3)",
      "• Stående kvasi-longitudinella och torsionsvågor (Lärobok: Kapitel 6: 6.3.2-6.3.5.2 och 6.4.2)"
    ].join("\n"),
    quiz: {
      title: "Quiz 7 - Stående vågor och akustiska rumsmoder",
      due_at: "2026-11-16T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 8: Quiz 7 - Stående vågor och akustiska rumsmoder. Lämnas in innan föreläsningen.\nLänk: https://canvas.kth.se/courses/65466/quizzes/76666"
    }
  },

  // Övning 7
  {
    title: "Övning 7",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-11-17T15:00:00+01:00",
    description: [
      "Sal: Q34, Q36 (kl 15-17)",
      "",
      "Tema & Uppgifter:",
      "• Stående ljudvågor och akustiska rumsmoder (Uppgifter: 5:9, 5:10, 5:14)",
      "• Ljudtrycksfördelning rumsmoder (Uppgifter: 5:14)"
    ].join("\n")
  },

  // F9
  {
    title: "Föreläsning 9",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-11-20T13:00:00+01:00",
    description: [
      "Sal: D2 (kl 13-15)",
      "",
      "Aktivitet & Lärobok:",
      "• Randvillkor balkböjning (Lärobok: Kapitel 6: 6.5.2, 6.5.3, 6.5.5 och 6.5.6)",
      "• Stående böjbågor (Lärobok: Kapitel 6: 6.5.3 och 6.5.6)",
      "• Egenfrekvenser och svängningsformer böjvågor (Lärobok: Kapitel 6: 6.5.6)",
      "• Materialdämpning-Dämpade böjvågor (Lärobok: Kapitel 6: 6.7)"
    ].join("\n"),
    quiz: {
      title: "Quiz 8 - Stående böjvågor i balkar",
      due_at: "2026-11-19T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 9: Quiz 8 - Stående böjvågor i balkar. Lämnas in innan föreläsningen."
    }
  },

  // Övning 8
  {
    title: "Övning 8",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-11-20T15:00:00+01:00",
    description: [
      "Sal: Q34, Q36 (kl 15-17)",
      "",
      "Tema & Uppgifter:",
      "• Dämpning böjvågor - Komplex E-modul (Uppgifter: 6:2)",
      "• Våglängd, fashastighet böjsvängande balk (Uppgifter: 6:1)",
      "• Egenfrekvenser kvasi-long och torsionsvågor (Uppgifter: 6:6)",
      "• Egenfrekvenser böjsvängande balkar (Uppgifter: 6:6, 6:8)"
    ].join("\n")
  },

  // F10
  {
    title: "Föreläsning 10",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-11-25T13:00:00+01:00",
    description: [
      "Sal: D2 (kl 13-15)",
      "",
      "Aktivitet & Lärobok:",
      "• Statistisk rumsakustik (Lärobok: Kapitel 7: 7.1-7.2.2)",
      "• Energimetoder (Lärobok: Kapitel 7: 7.1)",
      "• Diffust fält (Lärobok: Kapitel 7: 7.1.2)",
      "• Absorptionsfaktor-Ekvivalent absorptionsarea (Lärobok: Kapitel 7: 7.1-7.2.1.1)",
      "• Efterklangstid (Lärobok: Kapitel 7: 7.1-7.2.1.1 och 7.2.1.2)",
      "• Liten källa i rum (Lärobok: Kapitel 7: 7.2.2)"
    ].join("\n"),
    quiz: {
      title: "Quiz 9 - Statistisk rumsakustik - Absorption",
      due_at: "2026-11-24T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 10: Quiz 9 - Statistisk rumsakustik - Absorption. Lämnas in innan föreläsningen."
    }
  },

  // Seminarium 2
  {
    title: "Seminarium 2",
    task_type: "seminarie",
    task_kind: "exam",
    due_at: "2026-11-25T15:00:00+01:00",
    description: "Sal: Q34, Q36 [Ny tid] [Flyttad från Torsdag 26 november, kl 10-11] (kl 15-16)\n\nAktivitet:\n• Seminarium 2"
  },

  // Förberedelse Teori-KS2
  {
    title: "Förberedelse Teori-KS2",
    task_type: "ovning",
    task_kind: "task",
    due_at: "2026-11-25T16:00:00+01:00",
    description: "Sal: Q34, Q36 [Ny tid] [Flyttad från Torsdag 26 november, kl 11-12] (kl 16-17)\n\nAktivitet:\n• Förberedelse Teori-KS2"
  },

  // Övning 9
  {
    title: "Övning 9",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-11-26T08:00:00+01:00",
    description: [
      "Sal: U51, U61 [Ny tid] [Flyttad från Onsdag 25 november, kl 15-17] (kl 8-10)",
      "",
      "Tema & Uppgifter:",
      "• Statistisk rumsakustik (Uppgifter: 7:1, 7:2, 7:5, 7:6, 7:7)",
      "• Efterklangstid - Ekvivalent absorptionsarea (Uppgifter: 7:1, 7:2, 7:5, 7:6, 7:7)",
      "• Källa i rum (Uppgifter: 7:5, 7:6, 7:7)",
      "• Direktfält - Efterklangsfält (Uppgifter: 7:5, 7:6, 7:7)"
    ].join("\n")
  },

  // Kontrollskrivning 2
  {
    title: "Kontrollskrivning 2",
    task_type: "kontrollskrivning",
    task_kind: "exam",
    due_at: "2026-11-27T13:00:00+01:00",
    description: "Kontrollskrivning 2 (kl 13-15)"
  },

  // F11
  {
    title: "Föreläsning 11",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-11-30T08:00:00+01:00",
    description: [
      "Sal: D2 (kl 8-10)",
      "",
      "Aktivitet & Lärobok:",
      "• Vibrationsisolering (Lärobok: Kapitel 9: Hela utom 9.5.6 och 9.6.2-9.6.4)",
      "• Insatsisolering - Vibrationsisolering (Lärobok: Kapitel 9: 9.3)",
      "• Massa-fjäder-dämpar-stelt underlagmodellen (Lärobok: Kapitel 9: 9.5-9.5.1)",
      "• Generaliserad modell (Lärobok: Kapitel 6: 6.6, Kapitel 9: 9.5.2-9.5.5)"
    ].join("\n"),
    quiz: {
      title: "Quiz 10 - Ljudstrålning från vibrerande ytor - Strålningsfaktor",
      due_at: "2026-11-29T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 11: Quiz 10 - Ljudstrålning från vibrerande ytor - Strålningsfaktor. Lämnas in innan föreläsningen.\nLänk: https://canvas.kth.se/courses/65466/quizzes/76628"
    }
  },

  // Övning 10
  {
    title: "Övning 10",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-11-30T15:00:00+01:00",
    description: [
      "Sal: U41, U51 [Ny tid] [Flyttad från Måndag 30 november, kl 10-12] (kl 15-17)",
      "",
      "Tema & Uppgifter:",
      "• Vibrationsisolering (Uppgifter: 9:2, 9:4, 9:8)",
      "• Insatsisolering - Vibrationsisolering (Uppgifter: 9:2, 9:4, 9:8)",
      "• Förluster i vibrationsisolatorn (Uppgifter: 9:8)"
    ].join("\n")
  },

  // F12
  {
    title: "Föreläsning 12",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-12-03T13:00:00+01:00",
    description: [
      "Sal: D2 (kl 13-15)",
      "",
      "Aktivitet & Lärobok:",
      "• Ljuddämpare (Lärobok: Kapitel 10: Hela utom 10.2.1 och 10.4)",
      "• Krav på ljuddämpare (Lärobok: Kapitel 10: 10.1.2)",
      "• Mått på ljudreduktion (Lärobok: Kapitel 10: 10.1.1)",
      "• Expansionskammare (Lärobok: Kapitel 10: 10.3.1 och 10.3.2)",
      "• Sidogrenar (Lärobok: Kapitel 10: 10.3.3)",
      "• Resistiva ljuddämpare (Lärobok: Kapitel 10: 10.5)"
    ].join("\n"),
    quiz: {
      title: "Quiz 11 - Ljuddämpare: Krav och mått på effektivitet",
      due_at: "2026-12-02T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 12: Quiz 11 - Ljuddämpare: Krav och mått på effektivitet. Lämnas in innan föreläsningen.\nLänk: https://canvas.kth.se/courses/65466/quizzes/76643"
    }
  },

  // Övning 11
  {
    title: "Övning 11",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-12-04T15:00:00+01:00",
    description: [
      "Sal: Q34, Q36 [Ny tid] [Flyttad från Torsdag 3 december, kl 15-17] (kl 15-17)",
      "",
      "Tema & Uppgifter:",
      "• Expansionskammare (Uppgifter: 10:4, 10:7)",
      "• Helmholtzresonator (Uppgifter: 10:3)"
    ].join("\n")
  },

  // F13
  {
    title: "Föreläsning 13",
    task_type: "annat",
    task_kind: "task",
    due_at: "2026-12-07T13:00:00+01:00",
    description: [
      "Sal: D2 (kl 13-15)",
      "",
      "Aktivitet & Lärobok:",
      "• Strålning från vibrerande ytor (Lärobok: Kapitel 8: 8.6)",
      "• Strålningsfaktor (Lärobok: Kapitel 8: 8.6)",
      "• Koincidens (Lärobok: Kapitel 8: 8.6)",
      "• Akustiskt flödesschema (Lärobok: Kapitel 11: 11.1 och 11.2)",
      "• Ljudgenereringsmekanismer (Lärobok: Kapitel 11: 11.3)",
      "• Bullerbekämpning vid källan (Lärobok: Kapitel 11: 11.4)",
      "• Bullerbekämpning längs vägen (Lärobok: Kapitel 11: 11.5)"
    ].join("\n"),
    quiz: {
      title: "Quiz 12",
      due_at: "2026-12-06T23:59:00+01:00",
      description: "Förberedelseuppgift inför Föreläsning 13: Quiz 12. Lämnas in innan föreläsningen."
    }
  },

  // Övning 12
  {
    title: "Övning 12",
    task_type: "ovning",
    task_kind: "exam",
    due_at: "2026-12-07T15:00:00+01:00",
    description: [
      "Sal: Q34, Q36 (kl 15-17)",
      "",
      "Tema & Uppgifter:",
      "• Koincidensfrekvens (Uppgifter: 8:17, 8:19)",
      "• Strålning från böjsvängande plattor (Uppgifter: 8:17, 8:18)",
      "• Strålningsfaktor (Uppgifter: 8:19)",
      "• Akustiskt flödesschema (Uppgifter: 11:1 Exempelsamling Teori)",
      "• Genereringsmekanismer (Uppgifter: 11:2)",
      "• Åtgärder vid källan (Uppgifter: 11:2, 11:3, 11:4, 11:5)"
    ].join("\n")
  },

  // Seminarium inför KS3
  {
    title: "Seminarium inför KS3",
    task_type: "seminarie",
    task_kind: "exam",
    due_at: "2026-12-08T13:00:00+01:00",
    description: "Sal: W37, W43 [Ny tid] (OBS! Detta är ett övningsseminarium!) [Flyttad från Tisdag 8 december, kl 15-17] (kl 13-15)\n\nAktivitet:\n• Seminarium inför KS3 (övningsseminarium)"
  },

  // Kontrollskrivning 3
  {
    title: "Kontrollskrivning 3",
    task_type: "kontrollskrivning",
    task_kind: "exam",
    due_at: "2026-12-11T13:00:00+01:00",
    description: "Kontrollskrivning 3 (kl 13-15)"
  },

  // Zoom - Frågestund inför tentamen
  {
    title: "Zoom - Frågestund inför tentamen",
    task_type: "annat",
    task_kind: "task",
    due_at: null,
    description: "Meddelas senare. Eventuell Zoom-länk och material inför denna frågestund hittas på Canvas (läggs upp senare)."
  },

  // Tentamen
  {
    title: "Tentamen",
    task_type: "tenta",
    task_kind: "exam",
    due_at: "2027-01-04T08:00:00+01:00",
    description: "Tentamen (kl 8:00-13:00)"
  },

  // Omtentamen
  {
    title: "Omtentamen",
    task_type: "tenta",
    task_kind: "exam",
    due_at: null,
    description: "Omtentamen: Påskens omtentamensperiod"
  }
];

async function main() {
  const passcode = "550155";
  const email = `code-${passcode}@studyos.local`;
  const password = `${passcode}-studyos-code`;

  console.log("Authenticating...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.error("Auth failed:", authError);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log("Logged in user:", userId);

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId);

  const sd1116 = courses?.find(c => c.code?.includes("SD1116") || c.name?.includes("SD1116"));
  if (!sd1116) {
    console.error("SD1116 course not found!");
    process.exit(1);
  }

  console.log(`Target Course: ${sd1116.name} (${sd1116.code}), ID: ${sd1116.id}`);

  // Fetch existing tasks to avoid duplicates
  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("id, title, due_at, parent_id")
    .eq("course_id", sd1116.id);

  console.log(`Found ${existingTasks?.length ?? 0} existing tasks for SD1116.`);

  // Update Mätövning 2 if exists
  const mat2 = existingTasks?.find(t => t.title === "Mätövning 2");
  if (mat2) {
    console.log("Updating description on existing Mätövning 2...");
    await supabase
      .from("tasks")
      .update({
        description: "Period: 16/11 - 20/11. Anmälan under Personer på Canvas."
      })
      .eq("id", mat2.id);
  }

  let insertedCount = 0;
  let quizCount = 0;

  for (const act of activities) {
    // Check if task already exists
    const existing = existingTasks?.find(t => t.title.toLowerCase() === act.title.toLowerCase() && t.parent_id === null);
    let parentId: string;

    const isoDueAt = act.due_at ? new Date(act.due_at).toISOString() : null;

    if (existing) {
      console.log(`Task already exists: "${act.title}", updating...`);
      const { data: updated, error: updErr } = await supabase
        .from("tasks")
        .update({
          due_at: isoDueAt,
          description: act.description,
          task_type: act.task_type,
          task_kind: act.task_kind
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updErr) {
        console.error(`Error updating task ${act.title}:`, updErr);
        continue;
      }
      parentId = updated.id;
    } else {
      console.log(`Inserting task: "${act.title}" (due: ${isoDueAt})...`);
      const { data: inserted, error: insErr } = await supabase
        .from("tasks")
        .insert({
          course_id: sd1116.id,
          user_id: userId,
          title: act.title,
          description: act.description,
          task_type: act.task_type,
          task_kind: act.task_kind,
          status: "todo",
          priority: "medium",
          due_at: isoDueAt,
          parent_id: null
        })
        .select()
        .single();

      if (insErr) {
        console.error(`Error inserting task ${act.title}:`, insErr);
        continue;
      }
      parentId = inserted.id;
      insertedCount++;
    }

    // Insert Quiz subtask if specified
    if (act.quiz) {
      const quizDueAt = new Date(act.quiz.due_at).toISOString();
      const existingQuiz = existingTasks?.find(
        t => t.parent_id === parentId || (t.title.toLowerCase() === act.quiz!.title.toLowerCase())
      );

      if (existingQuiz) {
        console.log(`  Subtask Quiz already exists: "${act.quiz.title}", updating...`);
        await supabase
          .from("tasks")
          .update({
            parent_id: parentId,
            due_at: quizDueAt,
            description: act.quiz.description,
            task_type: "quiz",
            task_kind: "exam"
          })
          .eq("id", existingQuiz.id);
      } else {
        console.log(`  Inserting subtask quiz: "${act.quiz.title}" (due: ${quizDueAt})...`);
        const { error: quizErr } = await supabase
          .from("tasks")
          .insert({
            course_id: sd1116.id,
            user_id: userId,
            title: act.quiz.title,
            description: act.quiz.description,
            task_type: "quiz",
            task_kind: "exam",
            status: "todo",
            priority: "medium",
            due_at: quizDueAt,
            parent_id: parentId
          });

        if (quizErr) {
          console.error(`  Error inserting quiz ${act.quiz.title}:`, quizErr);
        } else {
          quizCount++;
        }
      }
    }
  }

  console.log(`\nDONE! Inserted ${insertedCount} new tasks and ${quizCount} quizzes.`);
}

main();
