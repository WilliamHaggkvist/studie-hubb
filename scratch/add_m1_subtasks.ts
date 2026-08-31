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

  const { data: parentTasks } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("course_id", courseId)
    .ilike("title", "%Module 1%");

  if (!parentTasks || parentTasks.length === 0) {
    console.error("Module 1 task not found!");
    return;
  }

  const parentId = parentTasks[0].id;
  console.log(`Found parent module: ${parentTasks[0].title} (ID: ${parentId})`);

  const subtasks = [
    { title: "F1", description: null },
    { title: "F2", description: null },
    { title: "F3", description: null },
    { title: "F4", description: null },
    { title: "F5", description: null },
    { title: "F6", description: null },
    { title: "F7", description: null },
    { title: "Självstudier M1", description: null },
    { title: "Kapitel 1 i boken", description: null },
    { title: "Kapitel 3 i boken", description: null },
    { title: "Kapitel 15 i boken", description: null },
    { title: "Kapitel 16 i boken", description: null },
    { title: "Kapitel 17 i boken", description: null },
    { title: "Kapitel 4 i boken", description: null },
    { title: "Kapitel 6 i boken", description: "Sektion 6.5 endast övergriplig" },
    { title: "Kapitel 7 i boken", description: "Sektion 7.4 endast övergriplig" },
    { title: "Kapitel 8 i boken", description: "Sektion 8.4 endast övergriplig" },
  ];

  const tasksToInsert = subtasks.map(s => ({
    course_id: courseId,
    user_id: userId,
    parent_id: parentId,
    title: s.title,
    description: s.description,
    task_type: "annat",
    status: "todo",
    priority: "medium",
    due_at: null
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("tasks")
    .insert(tasksToInsert)
    .select();

  if (insertErr) {
    console.error("Error inserting subtasks:", insertErr);
    return;
  }

  console.log(`Successfully added ${inserted.length} subtasks to Module 1!`);
  inserted.forEach(t => console.log(`- ${t.title}${t.description ? ` (${t.description})` : ''}`));
}

main();
