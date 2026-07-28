import { supabase } from "../../lib/supabase";

import type {
  ChatMessage,
  SendAttachmentInput,
} from "./types";

const CHAT_FILES_BUCKET = "chat-files";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function sanitizeFileName(fileName: string) {
  const normalizedName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const sanitizedName = normalizedName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitizedName || "allegato";
}

function createStoragePath(
  conversationId: string,
  fileName: string,
) {
  const uniqueId = crypto.randomUUID();
  const safeFileName = sanitizeFileName(fileName);

  return `${conversationId}/${uniqueId}-${safeFileName}`;
}

function validateFile(file: File) {
  if (file.size <= 0) {
    throw new Error("Il file selezionato è vuoto.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "Il file supera il limite massimo di 10 MB.",
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      "Questo tipo di file non è supportato.",
    );
  }
}

function getImageDimensions(
  file: File,
): Promise<{
  width: number | null;
  height: number | null;
}> {
  if (!file.type.startsWith("image/")) {
    return Promise.resolve({
      width: null,
      height: null,
    });
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });

      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      resolve({
        width: null,
        height: null,
      });

      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  });
}

export async function sendMessageWithAttachment({
  conversationId,
  body,
  file,
  replyToMessageId = null,
}: SendAttachmentInput): Promise<ChatMessage> {
  validateFile(file);

  const storagePath = createStoragePath(
    conversationId,
    file.name,
  );

  const dimensions =
    await getImageDimensions(file);

  const { error: uploadError } =
    await supabase.storage
      .from(CHAT_FILES_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

  if (uploadError) {
    throw uploadError;
  }

  try {
    const { data, error } = await supabase.rpc(
      "send_message_with_attachment",
      {
        target_conversation_id: conversationId,
        message_body: body.trim() || null,
        target_reply_to_message_id:
          replyToMessageId,
        attachment_storage_path:
          storagePath,
        attachment_original_name:
          file.name,
        attachment_mime_type:
          file.type,
        attachment_file_size:
          file.size,
        attachment_width:
          dimensions.width,
        attachment_height:
          dimensions.height,
      },
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Il messaggio non è stato creato.",
      );
    }

    return {
      ...(data as ChatMessage),
      message_attachments: [],
    };
  } catch (error) {
    const { error: cleanupError } =
      await supabase.storage
        .from(CHAT_FILES_BUCKET)
        .remove([storagePath]);

    if (cleanupError) {
      console.error(
        "Errore durante la rimozione del file:",
        cleanupError,
      );
    }

    throw error;
  }
}

const SIGNED_URL_DURATION = 60 * 60;

export async function getAttachmentSignedUrl(
  storagePath: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CHAT_FILES_BUCKET)
    .createSignedUrl(
      storagePath,
      SIGNED_URL_DURATION,
    );

  if (error) {
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error(
      "Impossibile generare l'anteprima del file.",
    );
  }

  return data.signedUrl;
}

export async function downloadAttachment(
  storagePath: string,
  originalName: string,
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(CHAT_FILES_BUCKET)
    .download(storagePath);

  if (error) {
    throw error;
  }

  const objectUrl = URL.createObjectURL(data);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = originalName;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}