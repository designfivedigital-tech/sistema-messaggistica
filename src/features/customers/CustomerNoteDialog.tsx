import { useState } from "react";

import {
  CLOCKIFY_TRACKER_URL,
  ClockifyError,
} from "../clockify/clockifyTypes";
import {
  useClockifyOperators,
  useClockifyProjects,
  useStartClockifyTimer,
} from "../clockify/useClockify";
import type { ChatMessage } from "../messages/types";
import { useCreateCustomerNote } from "./useCreateCustomerNote";

type CustomerNoteDialogProps = {
  customerId: string;
  customerName: string;
  message: ChatMessage;
  onClose: () => void;
};

const OPERATOR_STORAGE_KEY =
  "clockify-operator-id";

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

function readStoredOperatorId(): string {
  try {
    return (
      window.localStorage.getItem(
        OPERATOR_STORAGE_KEY,
      ) ?? ""
    );
  } catch {
    return "";
  }
}

function storeOperatorId(operatorId: string) {
  try {
    window.localStorage.setItem(
      OPERATOR_STORAGE_KEY,
      operatorId,
    );
  } catch {
    // La scelta non verrà ricordata.
  }
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  return typeof error === "object" &&
    error !== null &&
    "message" in error
    ? String(error.message)
    : fallback;
}

export function CustomerNoteDialog({
  customerId,
  customerName,
  message,
  onClose,
}: CustomerNoteDialogProps) {
  const [body, setBody] = useState("");

  const [startTimer, setStartTimer] =
    useState(false);

  const [storedOperatorId, setStoredOperatorId] =
    useState(readStoredOperatorId);

  /*
   * Nota già salvata per cui il timer non è
   * ancora partito: si può solo riprovare
   * l'avvio, senza creare una seconda nota.
   */
  const [savedNoteId, setSavedNoteId] =
    useState<string | null>(null);

  const [needsProject, setNeedsProject] =
    useState(false);

  const [projectId, setProjectId] = useState("");

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const createNoteMutation =
    useCreateCustomerNote();

  const startTimerMutation =
    useStartClockifyTimer();

  const { data: operators = [] } =
    useClockifyOperators();

  const { data: projects = [] } =
    useClockifyProjects(needsProject);

  const isSaving =
    createNoteMutation.isPending ||
    startTimerMutation.isPending;

  const messagePreview =
    getMessagePreview(message);

  const operatorId = operators.some(
    (operator) => operator.id === storedOperatorId,
  )
    ? storedOperatorId
    : (operators[0]?.id ?? "");

  const timerRequested =
    startTimer && operators.length > 0;

  function handleClose() {
    if (isSaving) {
      return;
    }

    onClose();
  }

  function handleOperatorChange(value: string) {
    setStoredOperatorId(value);
    storeOperatorId(value);
  }

  async function handleSave() {
    /*
     * La scheda di Clockify va aperta subito,
     * durante il click: aprirla dopo le chiamate
     * di rete verrebbe bloccata dal browser.
     */
    const clockifyTab = timerRequested
      ? window.open("about:blank", "_blank")
      : null;

    try {
      setErrorMessage(null);

      let noteId = savedNoteId;

      if (!noteId) {
        const note =
          await createNoteMutation.mutateAsync({
            customerId,
            conversationId:
              message.conversation_id,
            messageId: message.id,
            messageBody: messagePreview,
            messageCreatedAt: message.created_at,
            body,
          });

        noteId = note.id;
        setSavedNoteId(note.id);
      }

      if (!timerRequested) {
        onClose();
        return;
      }

      const result =
        await startTimerMutation.mutateAsync({
          noteId,
          operatorId,
          projectId: needsProject
            ? projectId
            : null,
        });

      if (clockifyTab) {
        clockifyTab.location.href =
          CLOCKIFY_TRACKER_URL;
      }

      if (result.stoppedPreviousDescription) {
        setSuccessMessage(
          `Timer avviato su "${result.projectName}". Il timer precedente ("${result.stoppedPreviousDescription}") è stato fermato.`,
        );

        return;
      }

      onClose();
    } catch (saveError) {
      clockifyTab?.close();

      console.error(
        "Impossibile salvare la nota o avviare il timer:",
        saveError,
      );

      if (
        saveError instanceof ClockifyError &&
        saveError.code === "project-not-found"
      ) {
        setNeedsProject(true);
      }

      setErrorMessage(
        saveError instanceof ClockifyError
          ? `Nota salvata, ma timer non avviato: ${saveError.message}`
          : getErrorMessage(
              saveError,
              "Impossibile salvare la nota.",
            ),
      );
    }
  }

  if (successMessage) {
    return (
      <div
        className="customer-category-dialog"
        role="presentation"
      >
        <div
          className="customer-category-dialog__card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-note-title"
        >
          <h2 id="customer-note-title">
            Timer avviato
          </h2>

          <p>{successMessage}</p>

          <div className="customer-category-dialog__actions">
            <button
              type="button"
              className="customer-category-dialog__confirm"
              onClick={onClose}
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
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
          disabled={
            isSaving || savedNoteId !== null
          }
        />

        <label className="customer-note-dialog__timer">
          <input
            type="checkbox"
            checked={timerRequested}
            onChange={(event) =>
              setStartTimer(event.target.checked)
            }
            disabled={
              isSaving || operators.length === 0
            }
          />

          <span>Avvia timer su Clockify</span>
        </label>

        {operators.length === 0 && (
          <p className="customer-note-dialog__hint">
            Per usare il timer collega un operatore
            dalla pagina Clienti → Clockify.
          </p>
        )}

        {timerRequested && (
          <>
            <label htmlFor="customer-note-operator">
              Operatore
            </label>

            <select
              id="customer-note-operator"
              value={operatorId}
              onChange={(event) =>
                handleOperatorChange(
                  event.target.value,
                )
              }
              disabled={isSaving}
            >
              {operators.map((operator) => (
                <option
                  key={operator.id}
                  value={operator.id}
                >
                  {operator.name}
                </option>
              ))}
            </select>
          </>
        )}

        {timerRequested && needsProject && (
          <>
            <label htmlFor="customer-note-project">
              Progetto Clockify
            </label>

            <select
              id="customer-note-project"
              value={projectId}
              onChange={(event) =>
                setProjectId(event.target.value)
              }
              disabled={isSaving}
            >
              <option value="">
                Scegli un progetto...
              </option>

              {projects.map((project) => (
                <option
                  key={project.id}
                  value={project.id}
                >
                  {project.name}
                </option>
              ))}
            </select>
          </>
        )}

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
            {savedNoteId ? "Chiudi" : "Annulla"}
          </button>

          <button
            type="button"
            className="customer-category-dialog__confirm"
            onClick={() => void handleSave()}
            disabled={
              isSaving ||
              body.trim().length === 0 ||
              (savedNoteId !== null &&
                !timerRequested) ||
              (timerRequested &&
                needsProject &&
                projectId === "")
            }
          >
            {isSaving
              ? "Salvataggio..."
              : savedNoteId
                ? "Avvia timer"
                : timerRequested
                  ? "Salva e avvia timer"
                  : "Salva nota"}
          </button>
        </div>
      </div>
    </div>
  );
}
