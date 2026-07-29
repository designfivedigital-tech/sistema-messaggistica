import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";

import { useReplyStore } from "./replyStore";
import { useSendAttachment } from "./useSendAttachment";
import { useSendMessage } from "./useSendMessage";

type MessageComposerProps = {
  conversationId: string;
  senderId: string;
  onTypingChange?: (
    isTyping: boolean,
  ) => void | Promise<void>;
};

type FilePreview = {
  file: File;
  previewUrl: string | null;
};

const MAX_MESSAGE_LENGTH = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_MESSAGE = 10;

const ACCEPTED_FILE_TYPES = [
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
].join(",");

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😊", "😉", "😍", "🥰",
  "😘", "😎", "🤗", "🤔", "😂", "🤣", "😅", "🥲",
  "😢", "😭", "😮", "😱", "😴", "🙄", "😤", "😡",
  "👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👌",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
  "🔥", "✨", "🎉", "🎊", "✅", "❌", "⭐", "💯",
  "📎", "📄", "📷", "🎵", "💬", "📌", "🚀", "👋",
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function getFileIcon(file: File) {
  if (file.type.startsWith("image/")) {
    return "🖼️";
  }

  if (file.type === "application/pdf") {
    return "📄";
  }

  if (
    file.type.includes("word") ||
    file.type.includes("document")
  ) {
    return "📝";
  }

  if (
    file.type.includes("excel") ||
    file.type.includes("spreadsheet")
  ) {
    return "📊";
  }

  if (
    file.type.includes("powerpoint") ||
    file.type.includes("presentation")
  ) {
    return "📽️";
  }

  if (file.type.includes("zip")) {
    return "🗜️";
  }

  return "📎";
}

function getFileIdentifier(file: File) {
  return [
    file.name,
    file.size,
    file.lastModified,
  ].join("-");
}

export default function MessageComposer({
  conversationId,
  senderId,
  onTypingChange,
}: MessageComposerProps) {
  const [body, setBody] = useState("");

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [fileError, setFileError] =
    useState<string | null>(null);

  const [
    isEmojiPickerOpen,
    setIsEmojiPickerOpen,
  ] = useState(false);

  const [isDraggingFile, setIsDraggingFile] =
    useState(false);

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState<number | null>(null);

  const [
    completedUploadFiles,
    setCompletedUploadFiles,
  ] = useState(0);

  const [
    totalUploadFiles,
    setTotalUploadFiles,
  ] = useState(0);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const emojiPickerRef =
    useRef<HTMLDivElement | null>(null);

  const emojiButtonRef =
    useRef<HTMLButtonElement | null>(null);

  const typingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const isTypingRef = useRef(false);
  const dragCounterRef = useRef(0);

  const sendMessageMutation =
    useSendMessage();

  const sendAttachmentMutation =
    useSendAttachment();

  const replyMessage = useReplyStore(
    (state) => state.replyMessage,
  );

  const clearReplyMessage = useReplyStore(
    (state) => state.clearReplyMessage,
  );

  const activeReplyMessage =
    replyMessage?.conversationId ===
    conversationId
      ? replyMessage
      : null;

  const remainingCharacters =
    MAX_MESSAGE_LENGTH - body.length;

  const isSending =
    sendMessageMutation.isPending ||
    sendAttachmentMutation.isPending;

  const canSend =
    Boolean(senderId) &&
    !isSending &&
    (
      Boolean(body.trim()) ||
      selectedFiles.length > 0
    );

  const filePreviews =
    useMemo<FilePreview[]>(() => {
      return selectedFiles.map((file) => ({
        file,
        previewUrl:
          file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : null,
      }));
    }, [selectedFiles]);

  useEffect(() => {
    return () => {
      filePreviews.forEach((preview) => {
        if (preview.previewUrl) {
          URL.revokeObjectURL(
            preview.previewUrl,
          );
        }
      });
    };
  }, [filePreviews]);

  function resizeTextarea() {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      140,
    )}px`;
  }

  function stopTypingTimer() {
    if (!typingTimerRef.current) {
      return;
    }

    clearTimeout(
      typingTimerRef.current,
    );

    typingTimerRef.current = null;
  }

  function notifyTyping(
    isTyping: boolean,
  ) {
    if (
      isTypingRef.current === isTyping
    ) {
      return;
    }

    isTypingRef.current = isTyping;
    void onTypingChange?.(isTyping);
  }

  function scheduleTypingStop() {
    stopTypingTimer();

    typingTimerRef.current =
      setTimeout(() => {
        notifyTyping(false);
      }, 1800);
  }

  function handleCancelReply() {
    clearReplyMessage();

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function clearSelectedFiles() {
    setSelectedFiles([]);
    setFileError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeSelectedFile(
    fileToRemove: File,
  ) {
    const identifier =
      getFileIdentifier(fileToRemove);

    setSelectedFiles((currentFiles) =>
      currentFiles.filter(
        (file) =>
          getFileIdentifier(file) !==
          identifier,
      ),
    );

    setFileError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetComposer() {
    setBody("");
    setIsEmojiPickerOpen(false);

    clearSelectedFiles();
    clearReplyMessage();

    setUploadProgress(null);
    setCompletedUploadFiles(0);
    setTotalUploadFiles(0);

    requestAnimationFrame(() => {
      resizeTextarea();
      textareaRef.current?.focus();
    });
  }

  function handleEmojiButtonClick(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (isSending) {
      return;
    }

    setIsEmojiPickerOpen(
      (current) => !current,
    );
  }

  function insertEmoji(emoji: string) {
    const textarea =
      textareaRef.current;

    const selectionStart =
      textarea?.selectionStart ??
      body.length;

    const selectionEnd =
      textarea?.selectionEnd ??
      body.length;

    const nextBody =
      body.slice(0, selectionStart) +
      emoji +
      body.slice(selectionEnd);

    if (
      nextBody.length >
      MAX_MESSAGE_LENGTH
    ) {
      return;
    }

    setBody(nextBody);
    notifyTyping(true);
    scheduleTypingStop();

    requestAnimationFrame(() => {
      const nextCursorPosition =
        selectionStart + emoji.length;

      textareaRef.current?.focus();

      textareaRef.current?.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition,
      );
    });
  }

  function validateSelectedFile(
    file: File,
  ) {
    if (file.size <= 0) {
      return `Il file "${file.name}" è vuoto.`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `Il file "${file.name}" supera il limite massimo di 10 MB.`;
    }

    const acceptedTypes =
      ACCEPTED_FILE_TYPES.split(",");

    if (
      !acceptedTypes.includes(file.type)
    ) {
      return `Il tipo del file "${file.name}" non è supportato.`;
    }

    return null;
  }

  function addSelectedFiles(
    incomingFiles: File[],
  ) {
    setFileError(null);

    if (incomingFiles.length === 0) {
      return;
    }

    const validationError =
      incomingFiles
        .map(validateSelectedFile)
        .find(Boolean);

    if (validationError) {
      setFileError(validationError);
      return;
    }

    setSelectedFiles((currentFiles) => {
      const existingIdentifiers =
        new Set(
          currentFiles.map(
            getFileIdentifier,
          ),
        );

      const uniqueNewFiles =
        incomingFiles.filter(
          (file) =>
            !existingIdentifiers.has(
              getFileIdentifier(file),
            ),
        );

      const availableSlots =
        MAX_FILES_PER_MESSAGE -
        currentFiles.length;

      if (availableSlots <= 0) {
        setFileError(
          "Puoi allegare al massimo 10 file per messaggio.",
        );

        return currentFiles;
      }

      if (
        uniqueNewFiles.length >
        availableSlots
      ) {
        setFileError(
          `Puoi aggiungere ancora ${availableSlots} ${
            availableSlots === 1
              ? "file"
              : "file"
          }. Il limite è di 10 allegati per messaggio.`,
        );
      }

      return [
        ...currentFiles,
        ...uniqueNewFiles.slice(
          0,
          availableSlots,
        ),
      ];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  useEffect(() => {
    resizeTextarea();
  }, [body]);

  useEffect(() => {
    if (!activeReplyMessage) {
      return;
    }

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [activeReplyMessage]);

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }

    function handleDocumentPointerDown(
      event: PointerEvent,
    ) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        emojiPickerRef.current?.contains(
          target,
        ) ||
        emojiButtonRef.current?.contains(
          target,
        )
      ) {
        return;
      }

      setIsEmojiPickerOpen(false);
    }

    document.addEventListener(
      "pointerdown",
      handleDocumentPointerDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleDocumentPointerDown,
      );
    };
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    clearSelectedFiles();
    setIsEmojiPickerOpen(false);
    setUploadProgress(null);
  }, [conversationId]);

  useEffect(() => {
    return () => {
      stopTypingTimer();

      if (isTypingRef.current) {
        void onTypingChange?.(false);
      }
    };
  }, [onTypingChange]);

  async function submitMessage() {
    const normalizedBody =
      body.trim();

    if (!canSend) {
      return;
    }

    stopTypingTimer();
    notifyTyping(false);
    setFileError(null);

    try {
      if (selectedFiles.length > 0) {
        setUploadProgress(0);
        setCompletedUploadFiles(0);
        setTotalUploadFiles(
          selectedFiles.length,
        );

        await sendAttachmentMutation.mutateAsync({
          conversationId,
          body: normalizedBody,
          files: selectedFiles,

          replyToMessageId:
            activeReplyMessage?.id ??
            null,

          onUploadProgress: (
            completedFiles,
            totalFiles,
            currentFilePercentage,
          ) => {
            const globalPercentage =
              totalFiles > 0
                ? Math.min(
                    100,
                    Math.round(
                      (
                        completedFiles +
                        currentFilePercentage /
                          100
                      ) /
                        totalFiles *
                        100,
                    ),
                  )
                : 0;

            setCompletedUploadFiles(
              Math.min(
                completedFiles,
                totalFiles,
              ),
            );

            setTotalUploadFiles(
              totalFiles,
            );

            setUploadProgress(
              globalPercentage,
            );
          },
        });
      } else {
        await sendMessageMutation.mutateAsync({
          conversationId,
          senderId,
          body: normalizedBody,

          replyToMessageId:
            activeReplyMessage?.id ??
            null,
        });
      }

      resetComposer();
    } catch (error) {
      setUploadProgress(null);
      setCompletedUploadFiles(0);
      setTotalUploadFiles(0);

      console.error(
        "Errore durante l'invio:",
        error,
      );
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void submitMessage();
  }

  function handleChange(
    event:
      ChangeEvent<HTMLTextAreaElement>,
  ) {
    const nextBody =
      event.target.value;

    setBody(nextBody);

    if (!nextBody.trim()) {
      stopTypingTimer();
      notifyTyping(false);
      return;
    }

    notifyTyping(true);
    scheduleTypingStop();
  }

  function handleKeyDown(
    event:
      KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void submitMessage();
    }

    if (event.key === "Escape") {
      if (isEmojiPickerOpen) {
        event.preventDefault();
        setIsEmojiPickerOpen(false);
        return;
      }

      if (activeReplyMessage) {
        event.preventDefault();
        handleCancelReply();
      }
    }
  }

  function handleFileButtonClick(
    event:
      MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (isSending) {
      return;
    }

    fileInputRef.current?.click();
  }

  function handleFileChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    );

    addSelectedFiles(files);
  }

  function handleDragEnter(
    event:
      DragEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (isSending) {
      return;
    }

    dragCounterRef.current += 1;

    const containsFiles =
      event.dataTransfer.types.includes(
        "Files",
      );

    if (containsFiles) {
      setIsDraggingFile(true);
    }
  }

  function handleDragOver(
    event:
      DragEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (isSending) {
      event.dataTransfer.dropEffect =
        "none";

      return;
    }

    event.dataTransfer.dropEffect =
      "copy";
  }

  function handleDragLeave(
    event:
      DragEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current = Math.max(
      0,
      dragCounterRef.current - 1,
    );

    if (
      dragCounterRef.current === 0
    ) {
      setIsDraggingFile(false);
    }
  }

  function handleDrop(
    event:
      DragEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current = 0;
    setIsDraggingFile(false);

    if (isSending) {
      return;
    }

    const files = Array.from(
      event.dataTransfer.files,
    );

    addSelectedFiles(files);
  }

  const mutationError =
    sendAttachmentMutation.error ??
    sendMessageMutation.error;

  return (
    <form
      className={[
        "message-composer",
        isDraggingFile
          ? "message-composer--dragging"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={handleSubmit}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      {isDraggingFile && (
        <div
          className="message-composer__drop-overlay"
          aria-hidden="true"
        >
          <div className="message-composer__drop-content">
            <span className="message-composer__drop-icon">
              📎
            </span>

            <strong>
              Rilascia qui i file
            </strong>

            <span>
              Massimo 10 file, 10 MB ciascuno
            </span>
          </div>
        </div>
      )}

      {activeReplyMessage && (
        <div className="message-composer__reply">
          <div className="message-composer__reply-content">
            <span className="message-composer__reply-label">
              Risposta al messaggio
            </span>

            <p className="message-composer__reply-text">
              {activeReplyMessage.body ||
                "Messaggio senza testo"}
            </p>
          </div>

          <button
            type="button"
            className="message-composer__reply-close"
            onClick={handleCancelReply}
            disabled={isSending}
            aria-label="Annulla risposta"
            title="Annulla risposta"
          >
            ×
          </button>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="message-composer__attachments">
          <div className="message-composer__attachments-header">
            <strong>
              {selectedFiles.length}{" "}
              {selectedFiles.length === 1
                ? "allegato"
                : "allegati"}
            </strong>

            <span>
              massimo {MAX_FILES_PER_MESSAGE}
            </span>
          </div>

          <div className="message-composer__attachments-list">
            {filePreviews.map(
              ({
                file,
                previewUrl,
              }) => (
                <div
                  key={getFileIdentifier(
                    file,
                  )}
                  className="message-composer__attachment"
                >
                  {previewUrl ? (
                    <img
                      className="message-composer__attachment-preview"
                      src={previewUrl}
                      alt={`Anteprima di ${file.name}`}
                    />
                  ) : (
                    <div
                      className="message-composer__attachment-icon"
                      aria-hidden="true"
                    >
                      {getFileIcon(file)}
                    </div>
                  )}

                  <div className="message-composer__attachment-info">
                    <strong
                      className="message-composer__attachment-name"
                      title={file.name}
                    >
                      {file.name}
                    </strong>

                    <span className="message-composer__attachment-size">
                      {formatFileSize(
                        file.size,
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="message-composer__attachment-remove"
                    onClick={() =>
                      removeSelectedFile(
                        file,
                      )
                    }
                    disabled={isSending}
                    aria-label={`Rimuovi ${file.name}`}
                    title="Rimuovi allegato"
                  >
                    ×
                  </button>
                </div>
              ),
            )}
          </div>

          {uploadProgress !== null && (
            <div
              className="message-composer__upload"
              role="status"
              aria-live="polite"
            >
              <div className="message-composer__upload-header">
                <span>
                  Caricamento allegati
                </span>

                <span>
                  {uploadProgress}%
                </span>
              </div>

              <div
                className="message-composer__upload-track"
                role="progressbar"
                aria-label="Avanzamento caricamento allegati"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  uploadProgress
                }
              >
                <div
                  className="message-composer__upload-bar"
                  style={{
                    width: `${uploadProgress}%`,
                  }}
                />
              </div>

              <span className="message-composer__upload-count">
                {completedUploadFiles} di{" "}
                {totalUploadFiles} completati
              </span>
            </div>
          )}
        </div>
      )}

      <div className="message-composer__controls">
        <input
          ref={fileInputRef}
          className="message-composer__file-input"
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={handleFileChange}
          disabled={
            isSending ||
            selectedFiles.length >=
              MAX_FILES_PER_MESSAGE
          }
        />

        <button
          type="button"
          className="message-composer__attach"
          onClick={handleFileButtonClick}
          disabled={
            isSending ||
            selectedFiles.length >=
              MAX_FILES_PER_MESSAGE
          }
          aria-label="Allega uno o più file"
          title="Allega file"
        >
          <span aria-hidden="true">
            📎
          </span>
        </button>

        <div className="message-composer__emoji-wrapper">
          <button
            ref={emojiButtonRef}
            type="button"
            className="message-composer__emoji-button"
            onClick={
              handleEmojiButtonClick
            }
            disabled={isSending}
            aria-label="Apri selettore emoji"
            aria-expanded={
              isEmojiPickerOpen
            }
            title="Emoji"
          >
            <span aria-hidden="true">
              😊
            </span>
          </button>

          {isEmojiPickerOpen && (
            <div
              ref={emojiPickerRef}
              className="message-composer__emoji-picker"
              role="dialog"
              aria-label="Seleziona un'emoji"
            >
              <div className="message-composer__emoji-grid">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="message-composer__emoji-option"
                    onClick={() =>
                      insertEmoji(emoji)
                    }
                    aria-label={`Inserisci ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="message-composer__field">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedFiles.length > 0
                ? "Aggiungi un messaggio..."
                : activeReplyMessage
                  ? "Scrivi una risposta..."
                  : "Scrivi un messaggio..."
            }
            rows={1}
            maxLength={
              MAX_MESSAGE_LENGTH
            }
            disabled={isSending}
            aria-label={
              selectedFiles.length > 0
                ? "Aggiungi un messaggio agli allegati"
                : activeReplyMessage
                  ? "Scrivi una risposta"
                  : "Scrivi un messaggio"
            }
          />

          {remainingCharacters <=
            250 && (
            <span
              className={[
                "message-composer__counter",
                remainingCharacters <=
                50
                  ? "message-composer__counter--warning"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {remainingCharacters}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="message-composer__send"
          disabled={!canSend}
          aria-label="Invia messaggio"
          title="Invia messaggio"
        >
          {isSending ? (
            <span className="message-composer__sending">
              <span />
              <span />
              <span />
            </span>
          ) : (
            <>
              <span className="message-composer__send-label">
                Invia
              </span>

              <span
                className="message-composer__send-icon"
                aria-hidden="true"
              >
                ➤
              </span>
            </>
          )}
        </button>
      </div>

      <p className="message-composer__hint">
        Invio per spedire · Shift + Invio
        per andare a capo · Massimo 10
        allegati da 10 MB ciascuno
        {activeReplyMessage
          ? " · Esc per annullare la risposta"
          : ""}
      </p>

      {fileError && (
        <p className="message-composer__error">
          {fileError}
        </p>
      )}

      {(sendMessageMutation.isError ||
        sendAttachmentMutation.isError) && (
        <p className="message-composer__error">
          {mutationError instanceof Error
            ? mutationError.message
            : "Invio non riuscito."}
        </p>
      )}
    </form>
  );
}