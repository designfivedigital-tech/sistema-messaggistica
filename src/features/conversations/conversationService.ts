import { supabase } from "../../lib/supabase";

import type {
  CompanyConversation,
} from "./types";

type CompanyConversationRow = {
  id: string;
  customer_id: string;
  status: "open" | "closed";
  is_favorite: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;

  customer_display_name: string | null;
  customer_email: string | null;

  last_message_body: string | null;
  last_message_created_at: string | null;
  last_message_sender_id: string | null;

  unread_count: number | null;
};

export async function getCompanyConversations(): Promise<
  CompanyConversation[]
> {
  const { data, error } = await supabase.rpc(
    "get_company_conversations",
  );

  if (error) {
    console.error(
      "Errore recupero conversazioni aziendali:",
      error,
    );

    throw error;
  }

  const conversationRows =
    (data as CompanyConversationRow[] | null) ?? [];

  return conversationRows.map(
    (conversation): CompanyConversation => {
      const customer = {
        id: conversation.customer_id,
        display_name:
          conversation.customer_display_name ??
          "Cliente",
        email:
          conversation.customer_email ?? null,
      };

      return {
        id: conversation.id,
        customer_id: conversation.customer_id,
        status: conversation.status,
        is_favorite: conversation.is_favorite,
        archived_at: conversation.archived_at,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        last_message_body:
          conversation.last_message_body,
        last_message_created_at:
          conversation.last_message_created_at,
        last_message_sender_id:
          conversation.last_message_sender_id,
        unread_count:
          conversation.unread_count ?? 0,
        customer,
      };
    },
  );
}