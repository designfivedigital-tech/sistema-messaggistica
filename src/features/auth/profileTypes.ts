export type AppRole = "customer" | "company";

export type Profile = {
  id: string;
  role: AppRole;
  display_name: string;
  created_at: string;
  updated_at: string;
};