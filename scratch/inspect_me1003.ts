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
  console.log("Logged in user:", userId);

  const { data: courses, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId);

  console.log("Courses count:", courses?.length);
  console.log("Courses:", JSON.stringify(courses, null, 2));

  const me1003 = courses?.find(c => c.code === "ME1003" || c.name.includes("ME1003") || c.name.toLowerCase().includes("industriell"));
  if (me1003) {
    console.log("Found ME1003 course:", me1003);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("course_id", me1003.id);
    console.log("ME1003 tasks count:", tasks?.length);
    console.log("ME1003 tasks:", JSON.stringify(tasks, null, 2));
  } else {
    console.log("ME1003 course not found yet for user");
  }
}

main();
