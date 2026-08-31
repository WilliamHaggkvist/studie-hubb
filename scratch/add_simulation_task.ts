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

  const taskToInsert = {
    course_id: courseId,
    user_id: userId,
    parent_id: null,
    title: "Simulation",
    description: "Börjar 29/9 13:00, avslutas 6/10 13:00",
    task_type: "inlamningsuppgift",
    status: "todo",
    priority: "medium",
    due_at: "2026-10-06T13:00:00+02:00"
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("tasks")
    .insert([taskToInsert])
    .select();

  if (insertErr) {
    console.error("Error inserting Simulation task:", insertErr);
    return;
  }

  console.log("Successfully added Simulation task:", inserted[0]);
}

main();
