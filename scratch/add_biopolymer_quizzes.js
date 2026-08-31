import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function addBiopolymerQuizzes() {
  const email = "code-550155@studyos.local";
  const password = "550155-studyos-code";
  await supabase.auth.signInWithPassword({ email, password });

  const { data: course } = await supabase.from("courses").select("id").eq("code", "CK105V").single();
  const { data: biopolymerModule } = await supabase.from("tasks").select("id").eq("course_id", course.id).eq("title", "Biopolymer").single();

  if (!biopolymerModule) {
    console.error("Biopolymer module not found!");
    return;
  }

  const titles = [
    "Bioplast översikt",
    "Proteinbaserade Bioplaster",
    "Kolhydratbaserade Bioplaster"
  ];

  // 2026-10-23 23:59 Swedish time (UTC+2) -> 2026-10-23T21:59:00.000Z
  const due_at = "2026-10-23T21:59:00.000Z";

  const tasksToInsert = titles.map(title => ({
    course_id: course.id,
    user_id: biopolymerModule.user_id || "03d88114-9d73-4620-a4d4-f578e31e4b6d",
    parent_id: biopolymerModule.id,
    title,
    task_type: "quiz",
    task_kind: "exam",
    status: "todo",
    priority: "medium",
    due_at
  }));

  const { data, error } = await supabase.from("tasks").insert(tasksToInsert).select();

  if (error) {
    console.error("Error inserting biopolymer quizzes:", error);
  } else {
    console.log(`Successfully added ${data.length} quizzes to Biopolymer module!`);
    data.forEach(t => console.log(`- ❓ ${t.title} (due: ${t.due_at})`));
  }
}

addBiopolymerQuizzes();
