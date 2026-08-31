import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

interface OevningData {
  title: string;
  dateStr: string; // e.g. "2026-08-25T12:00:00.000Z"
  dateText: string;
  forslag: string;
  raknasjelv: string;
  recordingUrl?: string;
  notesUrl?: string;
}

const oevningar: OevningData[] = [
  {
    title: "Ö1",
    dateStr: "2026-08-25T12:00:00.000Z",
    dateText: "25/8",
    forslag: "2.5, 2.4, 2.8, 2.14, 2.17, KS 2025-11-20:1",
    raknasjelv: "2.9, 2.18, 2.7, 2.10, 2.16",
    recordingUrl: "https://www.youtube.com/watch?v=V991hOoDmHA"
  },
  {
    title: "Ö2",
    dateStr: "2026-08-27T12:00:00.000Z",
    dateText: "27/8",
    forslag: "2.21, 2.19, 2.27, 2.29",
    raknasjelv: "2.22, 2.23, 2.28, 2.32, 2.33, 2.37",
    recordingUrl: "https://www.youtube.com/watch?v=ku8S9-nXhYs"
  },
  {
    title: "Ö3",
    dateStr: "2026-09-01T12:00:00.000Z",
    dateText: "1/9",
    forslag: "2.31, 2.25, 2.26, 2.32, 2.38, 2.34, 2.36, 2.40a,b",
    raknasjelv: "2.34, 2.39, 2.41, 2.42",
    recordingUrl: "https://www.youtube.com/watch?v=wGx-vb5E6Us",
    notesUrl: "https://www.math.kth.se/matstat/gru/sf1915/ovning3"
  },
  {
    title: "Ö4",
    dateStr: "2026-09-02T12:00:00.000Z",
    dateText: "2/9",
    forslag: "3.9, 3.8, 3.27, 3.10, 3.12",
    raknasjelv: "3.2, 3.3, 3.4, 3.7, 3.11, 3.13",
    recordingUrl: "https://www.youtube.com/watch?v=MKoTAvOxVfg",
    notesUrl: "https://www.math.kth.se/matstat/gru/sf1915/ovning4"
  },
  {
    title: "Ö5",
    dateStr: "2026-09-04T12:00:00.000Z",
    dateText: "4/9",
    forslag: "3.20, 3.21, 3.28, 3.32, 4.1c, 4.21",
    raknasjelv: "3.14, 3.22, 3.29",
    recordingUrl: "https://www.youtube.com/watch?v=53I79Iph8fU"
  },
  {
    title: "Ö6",
    dateStr: "2026-09-07T12:00:00.000Z",
    dateText: "7/9",
    forslag: "4.7, 4.25, 4.15, 4.17, 4.18",
    raknasjelv: "4.5, 4.12, 4.16, 4.19, 4.23",
    recordingUrl: "https://www.youtube.com/watch?v=AEmdm4RcCmg"
  },
  {
    title: "Ö7",
    dateStr: "2026-09-10T12:00:00.000Z",
    dateText: "10/9",
    forslag: "5.1, 5.3, 5.17, 5.22, 5.23",
    raknasjelv: "5.2, 5.13, 5.14, 5.15, 5.16, 5.18, 5.19, 5.20",
    recordingUrl: "https://www.youtube.com/watch?v=QPyKnQkjmGc"
  },
  {
    title: "Ö8",
    dateStr: "2026-09-15T12:00:00.000Z",
    dateText: "15/9",
    forslag: "6.1, 6.4a,c, 6.12, 6.15, 6.21",
    raknasjelv: "6.5, 6.6, 6.16, 6.19, 6.20, 6.23, 6.24",
    recordingUrl: "https://www.youtube.com/watch?v=Yuk9c2KIkfs",
    notesUrl: "https://www.math.kth.se/matstat/gru/sf1915/ovning8"
  },
  {
    title: "Ö9",
    dateStr: "2026-09-18T12:00:00.000Z",
    dateText: "18/9",
    forslag: "7.1, 7.16, 7.27, 7.14, 7.28",
    raknasjelv: "7.2, 7.6, 7.15, 7.9, 7.24",
    recordingUrl: "https://www.youtube.com/watch?v=lICHFVB1zCw"
  },
  {
    title: "Ö10",
    dateStr: "2026-09-24T12:00:00.000Z",
    dateText: "24/9",
    forslag: "10.1, 11.2, 11.6, 11.10, 11.25, 11.11",
    raknasjelv: "10.4, 11.4, 11.1, 11.7, 11.8, 11.14, 11.16, 11.24, 11.12",
    recordingUrl: "https://www.youtube.com/watch?v=lKqS_MrXjX4"
  },
  {
    title: "Ö11",
    dateStr: "2026-09-25T12:00:00.000Z",
    dateText: "25/9",
    forslag: "11.29 med MK-skattning, 11.18, 11.20, 12.9, 12.18",
    raknasjelv: "12.1, 12.5, 12.8, 12.10, 12.12",
    recordingUrl: "https://www.youtube.com/watch?v=oFdfh0F4AKA"
  },
  {
    title: "Ö12",
    dateStr: "2026-09-29T12:00:00.000Z",
    dateText: "29/9",
    forslag: "12.25, 12.31, 12.33, 12.22, 12.13, 12.14, 12.32, 12.36",
    raknasjelv: "12.19, 12.21, 12.24 (antag normalfördelning)",
    recordingUrl: "https://www.youtube.com/watch?v=siz-7Y-mATY"
  },
  {
    title: "Ö13",
    dateStr: "2026-10-02T12:00:00.000Z",
    dateText: "2/10",
    forslag: "12.30, 12.37, 13.10",
    raknasjelv: "13.1, 13.2, 13.3, 13.8, 13.12",
    recordingUrl: "https://www.youtube.com/watch?v=AOmDJIIpQC4"
  },
  {
    title: "Ö14",
    dateStr: "2026-10-06T12:00:00.000Z",
    dateText: "6/10",
    forslag: "13.15, 13.5, 13.8, 13.9, 13.27",
    raknasjelv: "13.12, 13.20, 13.18, 13.25, 13.17, 13.16, 13.14, 13.13",
    recordingUrl: "https://www.youtube.com/watch?v=tPGe9DT6rgA"
  },
  {
    title: "Ö15",
    dateStr: "2026-10-07T12:00:00.000Z",
    dateText: "7/10",
    forslag: "13.28, 13.33, 13.31, 14.4",
    raknasjelv: "13.30, 13.32, 13.34, 13.35, 14.5, 14.3",
    recordingUrl: "Se Canvas / media gallery"
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

  const tasksToInsert = oevningar.map((oev, index) => {
    let desc = `Datum: ${oev.dateText}\nFörslag till uppgifter: ${oev.forslag}\nAtt räkna själv: ${oev.raknasjelv}`;
    if (oev.recordingUrl) {
      desc += `\nLänk till inspelning: ${oev.recordingUrl}`;
    }
    if (oev.notesUrl) {
      desc += `\nLänk till anteckningar: ${oev.notesUrl}`;
    }

    return {
      course_id: sf1916.id,
      user_id: userId,
      title: oev.title,
      description: desc,
      task_type: "annat",
      status: "todo",
      priority: "medium",
      due_at: oev.dateStr,
      sort_order: 100 + index + 1
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from("tasks")
    .insert(tasksToInsert)
    .select();

  if (insertError) {
    console.error("Error inserting exercise tasks:", insertError);
    return;
  }

  console.log(`Successfully inserted ${inserted.length} exercise tasks (Ö1-Ö15) for SF1916!`);
}

main();
