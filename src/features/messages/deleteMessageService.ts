import { supabase } from "../../lib/supabase";

const CHAT_FILES_BUCKET = "chat-files";

export async function deleteMessageForEveryone(
  messageId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "delete_message_for_everyone",
    {
      target_message_id: messageId,
    },
  );

  if (error) {
    throw error;
  }

  const attachmentPaths = Array.isArray(data)
    ? data.filter(
        (path): path is string =>
          typeof path === "string" &&
          path.length > 0,
      )
    : [];

  if (attachmentPaths.length === 0) {
    return;
  }

  const { error: storageError } =
    await supabase.storage
      .from(CHAT_FILES_BUCKET)
      .remove(attachmentPaths);

  if (storageError) {
    console.error(
      "Messaggio eliminato, ma non è stato possibile rimuovere alcuni file dallo Storage:",
      storageError,
    );

    throw new Error(
      "Il messaggio è stato eliminato, ma la pulizia degli allegati non è riuscita.",
    );
  }
}