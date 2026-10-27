import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  await supabase.auth.signInWithPassword({
    email: "code-550155@studyos.local",
    password: "550155-studyos-code"
  });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, due_at, task_type, task_kind, parent_id")
    .not("due_at", "is", null)
    .limit(20);

  console.log("Sample tasks with due_at:", tasks);
}

main();
