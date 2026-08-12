import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function run() {
  const email = "code-550155@studyos.local";
  
  // Try password provided by user or default code password
  const passwordsToTry = ["550155", "550155-studyos-code"];
  let authData = null;

  for (const password of passwordsToTry) {
    console.log(`Trying login with ${email} / ${password}...`);
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.data?.user) {
      authData = res.data;
      console.log("Logged in successfully!");
      break;
    } else {
      console.log("Login failed with password", password, res.error?.message);
    }
  }

  if (!authData?.user) {
    console.error("Failed to authenticate user.");
    return;
  }

  const userId = authData.user.id;
  console.log(`User ID: ${userId}`);

  // Check existing term dates for Vår 2027
  const { data: existingTerms, error: fetchErr } = await supabase
    .from("term_dates")
    .select("*")
    .eq("user_id", userId)
    .eq("year", 2027)
    .eq("term", "var");

  if (fetchErr) {
    console.error("Error fetching terms:", fetchErr);
    return;
  }

  console.log("Existing Vår 2027 terms:", existingTerms);

  const { data, error } = await supabase
    .from("term_dates")
    .upsert({
      user_id: userId,
      year: 2027,
      term: "var",
      start_date: "2027-01-12",
      end_date: "2027-05-31",
    }, { onConflict: "user_id,year,term" })
    .select();

  if (error) {
    console.error("Error upserting term_dates:", error);
  } else {
    console.log("Successfully added term Vår 2027:", data);
  }
}

run();
