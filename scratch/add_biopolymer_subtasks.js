import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const email = "code-550155@studyos.local";
  const password = "550155-studyos-code";
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  const userId = authData.user.id;

  const { data: course } = await supabase.from("courses").select("id").eq("code", "CK105V").single();
  if (!course) {
    console.error("Course CK105V not found");
    return;
  }

  const { data: parentTask } = await supabase.from("tasks").select("id").eq("course_id", course.id).eq("title", "Biopolymer").single();
  if (!parentTask) {
    console.error("Parent task Biopolymer not found");
    return;
  }

  const subtaskTitles = [
    "Vad är en polymer och vad är plast?",
    "Vad är en bioplast och vad är en nedbrytbar plast?",
    "Hur kan plast klassificeras?",
    "Vad används plast till och varför?",
    "Plasthistoria och plaststatistik"
  ];

  const deadline = "2026-10-23T23:59:59.000Z";

  const tasksToInsert = subtaskTitles.map(title => ({
    course_id: course.id,
    user_id: userId,
    parent_id: parentTask.id,
    title,
    task_type: "annat",
    status: "todo",
    priority: "medium",
    due_at: deadline
  }));

  const { data: inserted, error: insertErr } = await supabase.from("tasks").insert(tasksToInsert).select();
  if (insertErr) {
    console.error("Error inserting subtasks:", insertErr);
    return;
  }

  console.log(`Successfully added ${inserted.length} subtasks to Biopolymer!`);
  inserted.forEach(t => console.log(`- ${t.title}`));
}

run();
