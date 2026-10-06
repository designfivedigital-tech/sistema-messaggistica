import { queryClient } from "../../app/queryClient";
import { supabase } from "../../lib/supabase";
import type { AuthCredentials } from "./types";
import { unregisterPushNotifications } from "../notifications/pushService";

export async function loginUser({
  email,
  password,
}: AuthCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function logoutUser() {
  try {
    await unregisterPushNotifications();
  } catch (error) {
    console.warn(
      "Impossibile rimuovere la sottoscrizione push:",
      error,
    );
  }

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  queryClient.clear();
}