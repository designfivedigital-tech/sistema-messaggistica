import { supabase } from "../../lib/supabase";

import type {
  ChatMessage,
  SendMessageInput,
} from "./types";

export async function getConversationMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
        id,
        conversation_id,
        sender_id,
        body,
        reply_to_message_id,
        delivered_at,
        read_at,
        deleted_for_everyone_at,
        created_at,
        message_attachments (
          id,
          message_id,
          storage_path,
          original_name,
          mime_type,
          file_size,
          width,
          height,
          duration_seconds,
          created_at
        ),
        message_reactions (
          id,
          message_id,
          user_id,
          emoji,
          created_at,
          updated_at
        )
      `,
    )
    .eq("conversation_id", conversationId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (
    data?.map((message) => ({
      ...message,
      message_attachments:
        message.message_attachments ?? [],
      message_reactions:
        message.message_reactions ?? [],
    })) as ChatMessage[]
  ) ?? [];
}

async function notifyNewMessage(
  messageId: string,
): Promise<void> {
  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken =
    sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "Sessione non disponibile per la notifica",
    );
  }

  const { error } =
    await supabase.functions.invoke(
      "notify-message",
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        body: {
          messageId,
        },
      },
    );

  if (error) {
    let details = error.message;

    if (
      "context" in error &&
      error.context instanceof Response
    ) {
      try {
        const responseText =
          await error.context
            .clone()
            .text();

        if (responseText) {
          details =
            `${details}: ${responseText}`;
        }
      } catch {
        // Manteniamo il messaggio originale.
      }
    }

    throw new Error(details);
  }
}

export async function sendMessage({
  conversationId,
  senderId,
  body,
  replyToMessageId = null,
}: SendMessageInput): Promise<ChatMessage> {
  const normalizedBody = body.trim();

  if (!normalizedBody) {
    throw new Error("Scrivi un messaggio.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: normalizedBody,
      reply_to_message_id:
        replyToMessageId,
    })
    .select(
      `
        id,
        conversation_id,
        sender_id,
        body,
        reply_to_message_id,
        delivered_at,
        read_at,
        deleted_for_everyone_at,
        created_at
      `,
    )
    .single();

  if (error) {
  throw error;
}

try {
  await notifyNewMessage(data.id);
} catch (notificationError) {
  console.error(
    "Messaggio inviato, ma notifica push non recapitata:",
    notificationError,
  );
}

return {
  ...data,
  message_attachments: [],
  message_reactions: [],
} as ChatMessage;
}

export async function markConversationMessagesRead(
  conversationId: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    "mark_conversation_messages_read",
    {
      target_conversation_id:
        conversationId,
    },
  );

  if (error) {
    throw error;
  }
}