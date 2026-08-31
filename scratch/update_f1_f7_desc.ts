import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function main() {
  const email = "code-550155@studyos.local";
  const password = "550155-studyos-code";

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.error("Auth failed:", authError);
    return;
  }

  const userId = authData.user.id;

  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .eq("user_id", userId)
    .eq("code", "ME1003");

  if (!courses || courses.length === 0) {
    console.error("ME1003 course not found!");
    return;
  }

  const courseId = courses[0].id;

  const updates = [
    {
      title: "F1",
      description: "Innehåll: Introduction to the course\nLitteratur: Kap 1"
    },
    {
      title: "F2",
      description: "Innehåll: Industrial Business Models: Value Creation, Value Proposition, Value Capture\nLitteratur: Kap 3"
    },
    {
      title: "F3",
      description: "Innehåll: Business Strategy\nLitteratur: Kap 15"
    },
    {
      title: "F4",
      description: "Innehåll: Organizing Operations & HRM\nLitteratur: Kap 16 & 17"
    },
    {
      title: "F5",
      description: "Innehåll: Technological development as a competitive force\nLitteratur: Kap 4"
    },
    {
      title: "F6",
      description: "Innehåll: Value-creating Processes: Marketing\nLitteratur: Kap 6"
    },
    {
      title: "F7",
      description: "Innehåll: Value-creating Processes: Production - Product development\nLitteratur: Kap 7 & 8"
    }
  ];

  for (const item of updates) {
    const { data, error } = await supabase
      .from("tasks")
      .update({ description: item.description })
      .eq("course_id", courseId)
      .eq("title", item.title)
      .select();

    if (error) {
      console.error(`Error updating ${item.title}:`, error);
    } else {
      console.log(`Updated ${item.title}:`, data?.[0]?.description);
    }
  }
}

main();
