import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

const lectureDates: Record<string, string> = {
  "F1": "24/8",
  "F2": "26/8",
  "F3": "28/8",
  "F4": "1/9",
  "F5": "2/9",
  "F6": "4/9",
  "F7": "9/9",
  "F8": "11/9",
  "F9": "14/9",
  "F10": "17/9",
  "F11": "22/9",
  "F12": "25/9",
  "F13": "29/9",
  "F14": "30/9",
  "F15": "5/10"
};

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

  for (const task of tasks) {
    if (lectureDates[task.title]) {
      const dateText = lectureDates[task.title];
      let currentDesc = task.description || "";
      
      // If description already has Datum, clean it up or prepend
      if (!currentDesc.startsWith("Datum:")) {
        const newDesc = `Datum: ${dateText}\n${currentDesc}`;
        const { error: updateErr } = await supabase
          .from("tasks")
          .update({ description: newDesc })
          .eq("id", task.id);

        if (updateErr) {
          console.error(`Failed to update ${task.title}:`, updateErr);
        } else {
          console.log(`Updated ${task.title} with Datum: ${dateText}`);
        }
      } else {
        console.log(`${task.title} already has Datum!`);
      }
    }
  }
}

main();
