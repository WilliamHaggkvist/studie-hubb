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

  const { data: courses, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId);

  console.log("Courses found for user:", courses);

  const sf1916 = courses?.find(c => c.code?.includes("SF1916") || c.name?.includes("SF1916"));
  if (sf1916) {
    console.log("SF1916 course details:", sf1916);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("course_id", sf1916.id);
    console.log("Existing tasks for SF1916:", tasks);
  } else {
    console.log("SF1916 course NOT found for this user!");
  }
}

main();
