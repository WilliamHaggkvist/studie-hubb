import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function updateTaskTypes() {
  const email = "code-550155@studyos.local";
  const password = "550155-studyos-code";
  await supabase.auth.signInWithPassword({ email, password });
  const { data: course } = await supabase.from("courses").select("id").eq("code", "CK105V").single();
  const { data: moduleTask } = await supabase.from("tasks").select("id").eq("course_id", course.id).eq("title", "Polymera material i ett cirkulärt samhälle").single();

  const { data, error } = await supabase
    .from("tasks")
    .update({ task_type: "quiz" })
    .eq("parent_id", moduleTask.id)
    .select();

  if (error) {
    console.error("Error updating task types:", error);
  } else {
    console.log(`Updated ${data.length} tasks to task_type: 'quiz'!`);
  }
}

updateTaskTypes();
