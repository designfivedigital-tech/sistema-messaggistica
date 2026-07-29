export type ConversationStatus =
  | "new"
  | "in_progress"
  | "closed";

export type CustomerSummary = {
  id: string;
  display_name: string;
  email: string | null;
};

export type CompanyConversation = {
  id: string;
  customer_id: string;
  status: ConversationStatus;

  is_favorite: boolean;
  archived_at: string | null;

  created_at: string;
  updated_at: string;

  last_message_body: string | null;
  last_message_created_at: string | null;
  last_message_sender_id: string | null;

  unread_count: number;

  customer: CustomerSummary;
};