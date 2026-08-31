import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const email = "code-550155@studyos.local";
  const password = "550155-studyos-code";
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  const userId = authData.user.id;

  const { data: course } = await supabase.from("courses").select("id").eq("code", "CK105V").single();
  if (!course) {
    console.error("Course CK105V not found");
    return;
  }

  // 1. Create or ensure module "Polymera material i ett cirkulärt samhälle" exists
  let { data: moduleTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("course_id", course.id)
    .eq("title", "Polymera material i ett cirkulärt samhälle");

  let targetModule = moduleTasks && moduleTasks[0];

  if (!targetModule) {
    console.log("Creating module 'Polymera material i ett cirkulärt samhälle'...");
    const { data: newModule, error: createErr } = await supabase.from("tasks").insert({
      course_id: course.id,
      user_id: userId,
      title: "Polymera material i ett cirkulärt samhälle",
      task_type: "modul",
      status: "todo",
      priority: "medium",
      due_at: "2026-10-23T23:59:59.000Z"
    }).select().single();

    if (createErr) {
      console.error("Error creating module:", createErr);
      return;
    }
    targetModule = newModule;
  }

  console.log("Target module ID:", targetModule.id);

  // 2. Move subtasks from Biopolymer to targetModule
  const subtaskTitles = [
    "Vad är en polymer och vad är plast?",
    "Vad är en bioplast och vad är en nedbrytbar plast?",
    "Hur kan plast klassificeras?",
    "Vad används plast till och varför?",
    "Plasthistoria och plaststatistik"
  ];

  const { data: updatedSubtasks, error: updateErr } = await supabase
    .from("tasks")
    .update({ parent_id: targetModule.id })
    .eq("course_id", course.id)
    .in("title", subtaskTitles)
    .select();

  if (updateErr) {
    console.error("Error updating subtasks:", updateErr);
    return;
  }

  console.log(`Successfully moved ${updatedSubtasks.length} subtasks to '${targetModule.title}'!`);
}

run();
