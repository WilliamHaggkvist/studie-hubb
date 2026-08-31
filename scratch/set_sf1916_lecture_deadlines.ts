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

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .eq("course_id", sf1916.id);

  if (tasksError || !tasks) {
    console.error("Error fetching tasks:", tasksError);
    return;
  }

  console.log(`Found ${tasks.length} tasks in total.`);

  let updatedCount = 0;

  for (const task of tasks) {
    // Check if title is F1, F2, ..., F15 or starts with F followed by number
    if (/^F\d+$/i.test(task.title.trim())) {
      let dateStr: string | null = null;
      
      // Try parsing from description if present
      if (task.description) {
        const match = task.description.match(/Datum:\s*(\d{1,2})\/(\d{1,2})/i);
        if (match) {
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          dateStr = `2026-${month}-${day}T12:00:00+00:00`;
        }
      }

      if (dateStr) {
        const { error: updateErr } = await supabase
          .from("tasks")
          .update({ due_at: dateStr })
          .eq("id", task.id);

        if (updateErr) {
          console.error(`Failed to update due_at for ${task.title}:`, updateErr);
        } else {
          console.log(`Updated ${task.title} due_at -> ${dateStr}`);
          updatedCount++;
        }
      } else {
        console.warn(`Could not extract date from description for ${task.title}: "${task.description}"`);
      }
    }
  }

  console.log(`Successfully updated deadlines for ${updatedCount} lecture tasks.`);
}

main();
