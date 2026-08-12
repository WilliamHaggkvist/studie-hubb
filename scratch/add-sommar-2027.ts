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
  const password = "550155-studyos-code";

  console.log(`Logging in as ${email}...`);
  const res = await supabase.auth.signInWithPassword({ email, password });
  if (!res.data?.user) {
    console.error("Failed to authenticate user:", res.error);
    return;
  }

  const userId = res.data.user.id;
  console.log(`User ID: ${userId}`);

  const summerTerm = {
    user_id: userId,
    year: 2027,
    term: "sommar" as const,
    start_date: "2027-06-01",
    end_date: "2027-08-29",
  };

  const { data, error } = await supabase
    .from("term_dates")
    .upsert(summerTerm, { onConflict: "user_id,year,term" })
    .select();

  if (error) {
    console.error(`Error upserting sommar 2027:`, error);
  } else {
    console.log(`Successfully added term sommar 2027:`, data);
  }
}

run();
