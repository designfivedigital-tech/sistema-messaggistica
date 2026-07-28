import { supabase } from "../../lib/supabase";

import type {
  ChatReaction,
  RemoveMessageReactionInput,
  SetMessageReactionInput,
} from "./types";

export async function setMessageReaction({
  messageId,
  userId,
  emoji,
}: SetMessageReactionInput): Promise<ChatReaction> {
  const normalizedEmoji = emoji.trim();

  if (!normalizedEmoji) {
    throw new Error("Seleziona una reazione.");
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .upsert(
      {
        message_id: messageId,
        user_id: userId,
        emoji: normalizedEmoji,
      },
      {
        onConflict: "message_id,user_id",
      },
    )
    .select(
      `
        id,
        message_id,
        user_id,
        emoji,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  return data as ChatReaction;
}

export async function removeMessageReaction({
  messageId,
  userId,
}: RemoveMessageReactionInput): Promise<void> {
  const { error } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}