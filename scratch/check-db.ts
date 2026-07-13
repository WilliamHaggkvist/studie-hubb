import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ppkstymysjzvvrepvbnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwa3N0eW15c2p6dnZyZXB2Ym5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjUwMDcsImV4cCI6MjA5ODY0MTAwN30.kSW9MJQW8xaWnEghIEpGKrhVouRjz7hl72pE4rMc4Zk";

const rawAssignments = `
Skapa flashcards; Annat;

Läs och anteckna, del 1 i boken; Annat;

Läs och anteckna, del 2 i boken; Annat;

Läs och anteckna, del 3 i boken; Annat;

Läs och anteckna, del 4 i boken; Annat;

Läs och anteckna, del 5 i boken; Annat;

Läs och anteckna, del 6 i boken; Annat;

Läs och anteckna, del 7 i boken; Annat;

Kolla igenom föreläsning 1 och anteckna; Annat;

Kolla igenom föreläsning 2 och anteckna; Annat;

Kolla igenom föreläsning 3 och anteckna; Annat;

Kolla igenom föreläsning 4 och anteckna; Annat;

Kolla igenom föreläsning 5 och anteckna; Annat;

Kolla igenom föreläsning 6 och anteckna; Annat;

Kolla igenom föreläsning 7 och anteckna; Annat;
`;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

function mapType(rawType: string): string {
  const t = rawType.trim().toLowerCase();
  if (t === "annat") return "annat";
  if (t === "modul") return "modul";
  if (t === "quiz") return "quiz";
  if (t === "inlämning" || t === "inlamning") return "inlamningsuppgift";
  if (t === "tenta") return "tenta";
  return "annat";
}

async function run() {
  const email = "code-550155@studyos.local";
  const password = "550155-studyos-code";

  console.log(`Logging in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.error("Authentication failed:", authError);
    return;
  }

  const userId = authData.user.id;
  console.log(`Logged in successfully! User ID: ${userId}`);

  // Check if course already exists
  let { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("*")
    .eq("name", "Positiv psykologi");

  if (coursesError) {
    console.error("Error fetching course:", coursesError);
    return;
  }

  let course = courses && courses[0];
  if (!course) {
    console.log("Course 'Positiv psykologi' not found. Creating it...");
    const { data: newCourse, error: createError } = await supabase
      .from("courses")
      .insert({
        name: "Positiv psykologi",
        user_id: userId,
        color: "#10B981", // Green accent color
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating course:", createError);
      return;
    }
    course = newCourse;
    console.log("Created course:", course);
  } else {
    console.log("Found existing course:", course);
  }

  // Parse tasks
  const tasksToInsert = rawAssignments
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.includes(";"))
    .map(line => {
      const parts = line.split(";");
      const title = parts[0].trim();
      const rawType = parts[1].trim();
      const task_type = mapType(rawType);
      return {
        course_id: course.id,
        user_id: userId,
        title,
        task_type,
        status: "todo",
        priority: "medium"
      };
    });

  console.log(`Parsed ${tasksToInsert.length} tasks. Inserting...`);

  const { data: insertedTasks, error: insertError } = await supabase
    .from("tasks")
    .insert(tasksToInsert)
    .select();

  if (insertError) {
    console.error("Error inserting tasks:", insertError);
    return;
  }

  console.log(`Successfully inserted ${insertedTasks.length} tasks!`);
}

run();
