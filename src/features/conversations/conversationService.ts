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
  customer_avatar_url: string | null;
  customer_website_url: string | null;

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
  avatar_url:
    conversation.customer_avatar_url ?? null,
  website_url:
    conversation.customer_website_url ?? null,
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

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    console.error(
      "Errore aggiornamento stato conversazione:",
      error,
    );

    throw error;
  }
}

export async function deleteConversationComplete(
  conversationId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "delete_conversation_complete",
    {
      target_conversation_id: conversationId,
    },
  );

  if (error) {
    console.error(
      "Errore eliminazione conversazione:",
      error,
    );

    throw error;
  }

  const storagePaths =
    Array.isArray(data)
      ? data.filter(
          (value): value is string =>
            typeof value === "string" &&
            value.length > 0,
        )
      : [];

  if (storagePaths.length === 0) {
    return;
  }

  const { error: storageError } =
    await supabase.storage
      .from("chat-files")
      .remove(storagePaths);

  if (storageError) {
    console.error(
      "Conversazione eliminata, ma alcuni file non sono stati rimossi dallo Storage:",
      storageError,
    );

    throw new Error(
      "La conversazione è stata eliminata, ma non è stato possibile rimuovere tutti i file allegati.",
    );
  }
}