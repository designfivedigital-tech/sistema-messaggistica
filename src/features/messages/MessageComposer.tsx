import {
  useEffect,
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

const MAX_MESSAGE_LENGTH = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function MessageComposer({
  conversationId,
  senderId,
  onTypingChange,
}: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] =
    useState<string | null>(null);
  const [fileError, setFileError] =
    useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] =
    useState(false);
  const [isDraggingFile, setIsDraggingFile] =
  useState(false);


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

  const sendMessageMutation = useSendMessage();
  const sendAttachmentMutation =
    useSendAttachment();

  const replyMessage = useReplyStore(
    (state) => state.replyMessage,
  );

  const clearReplyMessage = useReplyStore(
    (state) => state.clearReplyMessage,
  );

  const activeReplyMessage =
    replyMessage?.conversationId === conversationId
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
    (Boolean(body.trim()) ||
      Boolean(selectedFile));

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
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }

  function notifyTyping(isTyping: boolean) {
    if (isTypingRef.current === isTyping) {
      return;
    }

    isTypingRef.current = isTyping;
    void onTypingChange?.(isTyping);
  }

  function scheduleTypingStop() {
    stopTypingTimer();

    typingTimerRef.current = setTimeout(() => {
      notifyTyping(false);
    }, 1800);
  }

  function handleCancelReply() {
    clearReplyMessage();

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setFileError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetComposer() {
    setBody("");
    setIsEmojiPickerOpen(false);
    clearSelectedFile();
    clearReplyMessage();

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

    setIsEmojiPickerOpen((current) => !current);
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? body.length;
    const selectionEnd = textarea?.selectionEnd ?? body.length;

    const nextBody =
      body.slice(0, selectionStart) +
      emoji +
      body.slice(selectionEnd);

    if (nextBody.length > MAX_MESSAGE_LENGTH) {
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

  function validateSelectedFile(file: File) {
    if (file.size <= 0) {
      return "Il file selezionato è vuoto.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "Il file supera il limite massimo di 10 MB.";
    }

    const acceptedTypes =
      ACCEPTED_FILE_TYPES.split(",");

    if (!acceptedTypes.includes(file.type)) {
      return "Questo tipo di file non è supportato.";
    }

    return null;
  }

  function selectFile(file: File) {
  setFileError(null);

  const validationError =
    validateSelectedFile(file);

  if (validationError) {
    setSelectedFile(null);
    setFileError(validationError);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    return;
  }

  setSelectedFile(file);

  requestAnimationFrame(() => {
    textareaRef.current?.focus();
  });
}

  useEffect(() => {
    resizeTextarea();
  }, [body]);

  useEffect(() => {
    if (activeReplyMessage) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [activeReplyMessage]);

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        emojiPickerRef.current?.contains(target) ||
        emojiButtonRef.current?.contains(target)
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
    if (
      !selectedFile ||
      !selectedFile.type.startsWith("image/")
    ) {
      setFilePreviewUrl(null);
      return;
    }

    const objectUrl =
      URL.createObjectURL(selectedFile);

    setFilePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    clearSelectedFile();
    setIsEmojiPickerOpen(false);
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
    const normalizedBody = body.trim();

    if (!canSend) {
      return;
    }

    stopTypingTimer();
    notifyTyping(false);
    setFileError(null);

    try {
      if (selectedFile) {
        await sendAttachmentMutation.mutateAsync({
          conversationId,
          body: normalizedBody,
          file: selectedFile,
          replyToMessageId:
            activeReplyMessage?.id ?? null,
        });
      } else {
        await sendMessageMutation.mutateAsync({
          conversationId,
          senderId,
          body: normalizedBody,
          replyToMessageId:
            activeReplyMessage?.id ?? null,
        });
      }

      resetComposer();
    } catch (error) {
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
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    const nextBody = event.target.value;

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
    event: KeyboardEvent<HTMLTextAreaElement>,
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
  event: MouseEvent<HTMLButtonElement>,
) {
  event.preventDefault();
  event.stopPropagation();

  if (isSending) {
    return;
  }

  fileInputRef.current?.click();
}

  function handleFileChange(
  event: ChangeEvent<HTMLInputElement>,
) {
  const file =
    event.target.files?.[0] ?? null;

  if (!file) {
    return;
  }

  selectFile(file);
}

function handleDragEnter(
  event: DragEvent<HTMLFormElement>,
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
  event: DragEvent<HTMLFormElement>,
) {
  event.preventDefault();
  event.stopPropagation();

  if (isSending) {
    event.dataTransfer.dropEffect = "none";
    return;
  }

  event.dataTransfer.dropEffect = "copy";
}

function handleDragLeave(
  event: DragEvent<HTMLFormElement>,
) {
  event.preventDefault();
  event.stopPropagation();

  dragCounterRef.current = Math.max(
    0,
    dragCounterRef.current - 1,
  );

  if (dragCounterRef.current === 0) {
    setIsDraggingFile(false);
  }
}

function handleDrop(
  event: DragEvent<HTMLFormElement>,
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

  if (files.length === 0) {
    return;
  }

  if (files.length > 1) {
    setFileError(
      "Puoi allegare un solo file per messaggio.",
    );
    return;
  }

  selectFile(files[0]);
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
              Rilascia qui il file
            </strong>

            <span>
              Dimensione massima 10 MB
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

      {selectedFile && (
        <div className="message-composer__attachment">
          {filePreviewUrl ? (
            <img
              className="message-composer__attachment-preview"
              src={filePreviewUrl}
              alt={`Anteprima di ${selectedFile.name}`}
            />
          ) : (
            <div
              className="message-composer__attachment-icon"
              aria-hidden="true"
            >
              {getFileIcon(selectedFile)}
            </div>
          )}

          <div className="message-composer__attachment-info">
            <strong
              className="message-composer__attachment-name"
              title={selectedFile.name}
            >
              {selectedFile.name}
            </strong>

            <span className="message-composer__attachment-size">
              {formatFileSize(selectedFile.size)}
            </span>
          </div>

          <button
            type="button"
            className="message-composer__attachment-remove"
            onClick={clearSelectedFile}
            disabled={isSending}
            aria-label="Rimuovi allegato"
            title="Rimuovi allegato"
          >
            ×
          </button>
        </div>
      )}

      <div className="message-composer__controls">
        <input
          ref={fileInputRef}
          className="message-composer__file-input"
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          disabled={isSending}
        />

        <button
          type="button"
          className="message-composer__attach"
          onClick={handleFileButtonClick}
          disabled={isSending}
          aria-label="Allega un file"
          title="Allega un file"
        >
          <span aria-hidden="true">📎</span>
        </button>

        <div className="message-composer__emoji-wrapper">
          <button
            ref={emojiButtonRef}
            type="button"
            className="message-composer__emoji-button"
            onClick={handleEmojiButtonClick}
            disabled={isSending}
            aria-label="Apri selettore emoji"
            aria-expanded={isEmojiPickerOpen}
            title="Emoji"
          >
            <span aria-hidden="true">😊</span>
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
                    onClick={() => insertEmoji(emoji)}
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
              selectedFile
                ? "Aggiungi un messaggio..."
                : activeReplyMessage
                  ? "Scrivi una risposta..."
                  : "Scrivi un messaggio..."
            }
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={isSending}
            aria-label={
              selectedFile
                ? "Aggiungi un messaggio all'allegato"
                : activeReplyMessage
                  ? "Scrivi una risposta"
                  : "Scrivi un messaggio"
            }
          />

          {remainingCharacters <= 250 && (
            <span
              className={[
                "message-composer__counter",
                remainingCharacters <= 50
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
        Invio per spedire · Shift + Invio per andare a
        capo · Emoji disponibili · File massimo 10 MB
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