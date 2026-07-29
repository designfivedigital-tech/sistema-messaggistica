export type AppRole = "customer" | "company";

export type Profile = {
  id: string;
  role: AppRole;
  display_name: string;
  avatar_url: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
};

export type UpdateProfileInput = {
  displayName: string;
  websiteUrl: string | null;
  avatarUrl?: string | null;
};