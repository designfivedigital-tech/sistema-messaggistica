import { supabase } from "../../lib/supabase";
import type { Profile } from "./profileTypes";

export async function getCurrentProfile(): Promise<Profile> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Utente non autenticato.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}