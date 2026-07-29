import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabase";
import type {
  CompanyConversation,
  ConversationStatus,
} from "./types";

type CompanyConversationRow = {
  id: string;
  customer_id: string;
  status: ConversationStatus;

  is_favorite: boolean;
  archived_at: string | null;

  created_at: string;
  updated_at: string;

  customer_display_name: string | null;
  customer_email: string | null;

  last_message_body: string | null;
  last_message_created_at: string | null;
  last_message_sender_id: string | null;

  unread_count: number | string | null;
};

async function getCompanyConversations(): Promise<
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

  const rows =
    (data as CompanyConversationRow[] | null) ?? [];

  return rows.map(
    (row): CompanyConversation => ({
      id: row.id,
      customer_id: row.customer_id,
      status: row.status,

      is_favorite: row.is_favorite ?? false,
      archived_at: row.archived_at ?? null,

      created_at: row.created_at,
      updated_at: row.updated_at,

      customer: {
        id: row.customer_id,
        display_name:
          row.customer_display_name ??
          "Cliente",
        email: row.customer_email ?? null,
      },

      last_message_body:
        row.last_message_body ?? null,

      last_message_created_at:
        row.last_message_created_at ?? null,

      last_message_sender_id:
        row.last_message_sender_id ?? null,

      unread_count: Number(
        row.unread_count ?? 0,
      ),
    }),
  );
}

export function useCompanyConversations() {
  return useQuery({
    queryKey: ["company-conversations"],
    queryFn: getCompanyConversations,
    staleTime: 10_000,
    retry: 1,
  });
}