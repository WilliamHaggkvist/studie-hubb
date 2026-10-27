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

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, code")
    .eq("code", "SD1116")
    .single();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, due_at, task_type, task_kind, parent_id, description")
    .eq("course_id", course.id)
    .order("due_at", { ascending: true, nullsFirst: false });

  console.log(`Total tasks in SD1116: ${tasks?.length}`);

  const rootTasks = tasks?.filter(t => !t.parent_id);
  const children = tasks?.filter(t => t.parent_id);

  console.log(`Root tasks count: ${rootTasks?.length}`);
  console.log(`Subtasks count: ${children?.length}\n`);

  for (const root of rootTasks || []) {
    const localDate = root.due_at ? new Date(root.due_at).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" }) : "Inget datum";
    console.log(`📌 [${root.task_type}] ${root.title} - ${localDate}`);
    const kids = children?.filter(c => c.parent_id === root.id);
    for (const kid of kids || []) {
      const kidDate = kid.due_at ? new Date(kid.due_at).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" }) : "Inget datum";
      console.log(`   └── ❓ [${kid.task_type}] ${kid.title} (Förfaller: ${kidDate})`);
    }
  }
}

main();
