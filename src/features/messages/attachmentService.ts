import * as tus from "tus-js-client";

import { supabase } from "../../lib/supabase";

import type {
  ChatMessage,
  SendAttachmentInput,
} from "./types";

const CHAT_FILES_BUCKET = "chat-files";

const MAX_FILES_PER_MESSAGE = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SIGNED_URL_DURATION = 60 * 60;

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

type UploadedAttachment = {
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
};

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
    throw new Error(
      `Il file "${file.name}" è vuoto.`,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `Il file "${file.name}" supera il limite massimo di 10 MB.`,
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Il tipo del file "${file.name}" non è supportato.`,
    );
  }
}

function validateFiles(files: File[]) {
  if (files.length === 0) {
    throw new Error(
      "Nessun file selezionato.",
    );
  }

  if (files.length > MAX_FILES_PER_MESSAGE) {
    throw new Error(
      "Puoi allegare al massimo 10 file per messaggio.",
    );
  }

  files.forEach(validateFile);
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
    const objectUrl =
      URL.createObjectURL(file);

    const image = new Image();

    function cleanup() {
      URL.revokeObjectURL(objectUrl);
    }

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });

      cleanup();
    };

    image.onerror = () => {
      resolve({
        width: null,
        height: null,
      });

      cleanup();
    };

    image.src = objectUrl;
  });
}

async function uploadFileWithProgress({
  file,
  storagePath,
  onProgress,
}: {
  file: File;
  storagePath: string;
  onProgress?: (
    percentage: number,
  ) => void;
}): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error(
      "Sessione non disponibile. Accedi nuovamente.",
    );
  }

  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error(
      "VITE_SUPABASE_URL non è configurato.",
    );
  }

  await new Promise<void>(
    (resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint:
          `${supabaseUrl}/storage/v1/upload/resumable`,

        retryDelays: [
          0,
          1000,
          3000,
          5000,
        ],

        headers: {
          authorization:
            `Bearer ${session.access_token}`,
          "x-upsert": "false",
        },

        metadata: {
          bucketName: CHAT_FILES_BUCKET,
          objectName: storagePath,
          contentType:
            file.type ||
            "application/octet-stream",
          cacheControl: "3600",
        },

        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,

        onError(error) {
          reject(error);
        },

        onProgress(
          bytesUploaded,
          bytesTotal,
        ) {
          if (bytesTotal <= 0) {
            onProgress?.(0);
            return;
          }

          const percentage = Math.min(
            100,
            Math.round(
              (bytesUploaded / bytesTotal) *
                100,
            ),
          );

          onProgress?.(percentage);
        },

        onSuccess() {
          onProgress?.(100);
          resolve();
        },
      });

      upload.start();
    },
  );
}

async function removeUploadedFiles(
  storagePaths: string[],
) {
  if (storagePaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage
    .from(CHAT_FILES_BUCKET)
    .remove(storagePaths);

  if (error) {
    console.error(
      "Errore durante la rimozione dei file:",
      error,
    );
  }
}

async function uploadAttachments({
  conversationId,
  files,
  onUploadProgress,
}: {
  conversationId: string;
  files: File[];
  onUploadProgress?:
    SendAttachmentInput["onUploadProgress"];
}): Promise<UploadedAttachment[]> {
  const uploadedAttachments:
    UploadedAttachment[] = [];

  const generatedStoragePaths: string[] =
    [];

  const totalFiles = files.length;

  try {
    for (
      let fileIndex = 0;
      fileIndex < files.length;
      fileIndex += 1
    ) {
      const file = files[fileIndex];

      const completedFiles = fileIndex;

      const storagePath =
        createStoragePath(
          conversationId,
          file.name,
        );

      generatedStoragePaths.push(
        storagePath,
      );

      const dimensions =
        await getImageDimensions(file);

      onUploadProgress?.(
        completedFiles,
        totalFiles,
        0,
      );

      await uploadFileWithProgress({
        file,
        storagePath,

        onProgress: (percentage) => {
          onUploadProgress?.(
            completedFiles,
            totalFiles,
            percentage,
          );
        },
      });

      uploadedAttachments.push({
        storage_path: storagePath,
        original_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        width: dimensions.width,
        height: dimensions.height,
      });

      onUploadProgress?.(
        completedFiles + 1,
        totalFiles,
        100,
      );
    }

    return uploadedAttachments;
  } catch (error) {
    await removeUploadedFiles(
      generatedStoragePaths,
    );

    throw error;
  }
}

export async function sendMessageWithAttachment({
  conversationId,
  body,
  files,
  replyToMessageId = null,
  onUploadProgress,
}: SendAttachmentInput): Promise<ChatMessage> {
  validateFiles(files);

  const uploadedAttachments =
    await uploadAttachments({
      conversationId,
      files,
      onUploadProgress,
    });

  const uploadedStoragePaths =
    uploadedAttachments.map(
      (attachment) =>
        attachment.storage_path,
    );

  try {
    const { data, error } =
      await supabase.rpc(
        "send_message_with_attachments",
        {
          target_conversation_id:
            conversationId,

          message_body:
            body.trim() || null,

          target_reply_to_message_id:
            replyToMessageId,

          attachments_data:
            uploadedAttachments,
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
    await removeUploadedFiles(
      uploadedStoragePaths,
    );

    throw error;
  }
}

export async function getAttachmentSignedUrl(
  storagePath: string,
): Promise<string> {
  const { data, error } =
    await supabase.storage
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
  const { data, error } =
    await supabase.storage
      .from(CHAT_FILES_BUCKET)
      .download(storagePath);

  if (error) {
    throw error;
  }

  const objectUrl =
    URL.createObjectURL(data);

  const anchor =
    document.createElement("a");

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