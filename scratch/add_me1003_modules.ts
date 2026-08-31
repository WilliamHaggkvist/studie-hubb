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

  const me1003 = courses?.find(c => c.code === "ME1003" || c.name.includes("ME1003"));
  if (!me1003) {
    console.error("ME1003 course not found!");
    return;
  }

  console.log("Found ME1003 course ID:", me1003.id);

  const modulesToInsert = [
    {
      course_id: me1003.id,
      user_id: userId,
      title: "Module 1: Industrial value creation",
      description: "- Technical development as a competitive factor\n- Technology-based business models and strategies\n- Innovation, product development, production and marketing\n- Organization\n- Human resource management and leadership",
      task_type: "modul",
      status: "todo",
      priority: "medium",
      due_at: "2026-09-06T21:59:00.000Z"
    },
    {
      course_id: me1003.id,
      user_id: userId,
      title: "Module 2: Product Costing",
      description: "- Profit planning\n- Product costing (full costing, contribution costing and activity-based costing)\n- Investment calculation and investment evaluation",
      task_type: "modul",
      status: "todo",
      priority: "medium",
      due_at: "2026-09-16T21:59:00.000Z"
    },
    {
      course_id: me1003.id,
      user_id: userId,
      title: "Module 3: Accounting and Corporate Finance",
      description: "- Bookkeeping and accounting\n- Annual report and financial analysis\n- Corporate financing\n- Corporate risk analysis",
      task_type: "modul",
      status: "todo",
      priority: "medium",
      due_at: "2026-09-30T21:59:00.000Z"
    }
  ];

  const { data: inserted, error: insertError } = await supabase
    .from("tasks")
    .insert(modulesToInsert)
    .select();

  if (insertError) {
    console.error("Error inserting modules:", insertError);
    return;
  }

  console.log("Successfully inserted modules:", inserted);
}

main();
