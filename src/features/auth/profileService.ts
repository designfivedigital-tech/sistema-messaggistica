import { supabase } from "../../lib/supabase";
import type {
  Profile,
  UpdateProfileInput,
} from "./profileTypes";

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
    .select(
      `
        id,
        role,
        display_name,
        avatar_url,
        website_url,
        created_at,
        updated_at
      `,
    )
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function updateCurrentProfile({
  displayName,
  websiteUrl,
  avatarUrl,
}: UpdateProfileInput): Promise<Profile> {
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

  const normalizedDisplayName =
    displayName.trim();

  if (!normalizedDisplayName) {
    throw new Error(
      "Il nome utente non può essere vuoto.",
    );
  }

  const updates: {
    display_name: string;
    website_url: string | null;
    avatar_url?: string | null;
    updated_at: string;
  } = {
    display_name: normalizedDisplayName,
    website_url: websiteUrl?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (avatarUrl !== undefined) {
    updates.avatar_url = avatarUrl;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select(
      `
        id,
        role,
        display_name,
        avatar_url,
        website_url,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function getAvatarExtension(file: File) {
  const extension =
    file.name.split(".").pop()?.toLowerCase();

  if (
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "png" ||
    extension === "webp"
  ) {
    return extension === "jpeg"
      ? "jpg"
      : extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

export async function uploadCurrentUserAvatar(
  file: File,
): Promise<string> {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error(
      "Puoi caricare soltanto immagini JPG, PNG o WebP.",
    );
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error(
      "L’immagine non può superare 2 MB.",
    );
  }

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

  const extension = getAvatarExtension(file);

  const storagePath =
    `${user.id}/avatar.${extension}`;

  const { error: uploadError } =
    await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(storagePath);

  /*
   * Il parametro impedisce al browser di mostrare
   * la vecchia immagine dalla cache.
   */
  return `${data.publicUrl}?v=${Date.now()}`;
}