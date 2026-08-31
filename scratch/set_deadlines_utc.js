import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function setAllDeadlinesLocal2359() {
  const email = "code-550155@studyos.local";
  const password = "550155-studyos-code";
  await supabase.auth.signInWithPassword({ email, password });
  const { data: course } = await supabase.from("courses").select("id").eq("code", "CK105V").single();

  // 2026-10-23 23:59:00 Swedish Local Time (CEST, UTC+2) => 2026-10-23T21:59:00.000Z
  const due_at = "2026-10-23T21:59:00.000Z";

  const { data, error } = await supabase
    .from("tasks")
    .update({ due_at })
    .eq("course_id", course.id)
    .select();

  if (error) {
    console.error("Error updating deadlines:", error);
  } else {
    console.log(`Updated deadlines for ${data.length} tasks in CK105V to 2026-10-23T21:59:00.000Z (Local 23:59)!`);
    data.forEach(t => console.log(`- ${t.title}: ${t.due_at}`));
  }
}

setAllDeadlinesLocal2359();
