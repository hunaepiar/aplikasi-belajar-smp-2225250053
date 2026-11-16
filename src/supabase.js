
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Membuat koneksi jika konfigurasi Supabase tersedia.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Menyimpan progres belajar siswa ke Supabase.
export async function syncLearningProgress(progress) {
  if (!supabase) {
    return { skipped: true };
  }

  let { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (!sessionData.session) {
    const { data, error } =
      await supabase.auth.signInAnonymously();

    if (error) throw error;

    sessionData = { session: data.session };
  }

  const userId = sessionData.session?.user?.id;

  if (!userId) {
    throw new Error("Sesi anonim Supabase belum tersedia.");
  }

  const { error } = await supabase
    .from("student_learning_progress")
    .upsert(
      {
        owner_id: userId,
        progress,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" }
    );

  if (error) throw error;

  return { synced: true };
}