import { useState } from "react";

import type { ChatMessage } from "../messages/types";
import { useCreateCustomerNote } from "./useCreateCustomerNote";

type CustomerNoteDialogProps = {
  customerId: string;
  customerName: string;
  message: ChatMessage;
  onClose: () => void;
};

function getMessagePreview(
  message: ChatMessage,
): string | null {
  const body = message.body?.trim();

  if (body) {
    return body;
  }

  return message.message_attachments.length > 0
    ? "📎 Allegato"
    : null;
}

export function CustomerNoteDialog({
  customerId,
  customerName,
  message,
  onClose,
}: CustomerNoteDialogProps) {
  const [body, setBody] = useState("");

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const createNoteMutation =
    useCreateCustomerNote();

  const isSaving = createNoteMutation.isPending;

  const messagePreview =
    getMessagePreview(message);

  function handleClose() {
    if (isSaving) {
      return;
    }

    onClose();
  }

  async function handleSave() {
    try {
      setErrorMessage(null);

      await createNoteMutation.mutateAsync({
        customerId,
        conversationId: message.conversation_id,
        messageId: message.id,
        messageBody: messagePreview,
        messageCreatedAt: message.created_at,
        body,
      });

      onClose();
    } catch (saveError) {
      console.error(
        "Impossibile salvare la nota:",
        saveError,
      );

      setErrorMessage(
        typeof saveError === "object" &&
          saveError !== null &&
          "message" in saveError
          ? String(saveError.message)
          : "Impossibile salvare la nota.",
      );
    }
  }

  return (
    <div
      className="customer-category-dialog"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="customer-category-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-note-title"
      >
        <h2 id="customer-note-title">
          Aggiungi nota
        </h2>

        <p>
          Nota su{" "}
          <strong>{customerName}</strong>, salvata
          con la data di oggi.
        </p>

        {messagePreview && (
          <blockquote className="customer-note-dialog__quote">
            {messagePreview}
          </blockquote>
        )}

        <label htmlFor="customer-note-body">
          Testo della nota
        </label>

        <textarea
          id="customer-note-body"
          value={body}
          onChange={(event) =>
            setBody(event.target.value)
          }
          placeholder="Scrivi la nota..."
          rows={4}
          autoFocus
          disabled={isSaving}
        />

        {errorMessage && (
          <p className="customer-category-dialog__error">
            {errorMessage}
          </p>
        )}

        <div className="customer-category-dialog__actions">
          <button
            type="button"
            className="customer-category-dialog__cancel"
            onClick={handleClose}
            disabled={isSaving}
          >
            Annulla
          </button>

          <button
            type="button"
            className="customer-category-dialog__confirm"
            onClick={() => void handleSave()}
            disabled={
              isSaving || body.trim().length === 0
            }
          >
            {isSaving
              ? "Salvataggio..."
              : "Salva nota"}
          </button>
        </div>
      </div>
    </div>
  );
}
