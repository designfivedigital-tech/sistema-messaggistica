import {
  useEffect,
  useRef,
  useState,
} from "react";

import type { CompanyConversation } from "../conversations/types";
import { CustomerAvatar } from "./CustomerAvatar";
import {
  getCustomerCategoryLabel,
  type CustomerCategory,
} from "./customerCategory";
import {
  isNoteTimerRunning,
  type CustomerNote,
} from "./customerNote";
import {
  formatDuration,
  getClockifyProjectUrl,
  type CustomerClockifyProject,
} from "../clockify/clockifyTypes";
import {
  useClockifyOperators,
  useClockifyProjects,
  useSetCustomerClockifyProject,
  useStopClockifyTimer,
} from "../clockify/useClockify";

type CustomerDetailDialogProps = {
  conversation: CompanyConversation;
  category: CustomerCategory | null;

  /* Progetto Clockify abbinato al cliente. */
  clockifyProject: CustomerClockifyProject | null;

  /* Ordinate dalla più recente alla meno recente. */
  notes: CustomerNote[];
  notesErrorMessage: string | null;

  onOpenChat: () => void;

  /* Apre la chat sul messaggio annotato. */
  onOpenMessage: (note: CustomerNote) => void;
  onClose: () => void;
};

type NoteGroup = {
  key: string;
  label: string;
  notes: CustomerNote[];
};

const NOTES_PAGE_SIZE = 10;

const CONVERSATION_STATUS_LABELS = {
  new: "Nuova",
  in_progress: "In lavorazione",
  closed: "Chiusa",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatNoteDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWebsite(value: string) {
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function groupNotesByMonth(
  notes: CustomerNote[],
): NoteGroup[] {
  const groups: NoteGroup[] = [];

  for (const note of notes) {
    const date = new Date(note.created_at);

    const key = `${date.getFullYear()}-${date.getMonth()}`;

    const currentGroup = groups[groups.length - 1];

    if (currentGroup?.key === key) {
      currentGroup.notes.push(note);
      continue;
    }

    const label = new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
    }).format(date);

    groups.push({
      key,
      label:
        label.charAt(0).toUpperCase() +
        label.slice(1),
      notes: [note],
    });
  }

  return groups;
}

function CustomerNoteItem({
  note,
  onOpenMessage,
  onStopTimer,
  isStoppingTimer,
}: {
  note: CustomerNote;
  onOpenMessage: (note: CustomerNote) => void;
  onStopTimer: (noteId: string) => Promise<void>;
  isStoppingTimer: boolean;
}) {
  const bodyRef =
    useRef<HTMLParagraphElement | null>(null);

  const [isExpanded, setIsExpanded] =
    useState(false);

  const [isTruncated, setIsTruncated] =
    useState(false);

  /*
   * Il pulsante "Mostra tutto" serve solo se
   * il testo supera le righe visibili, cosa che
   * dipende dalla larghezza della finestra.
   */
  useEffect(() => {
    const element = bodyRef.current;

    if (!element || isExpanded) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setIsTruncated(
        element.scrollHeight >
          element.clientHeight + 1,
      );
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isExpanded]);

  return (
    <li>
      <time dateTime={note.created_at}>
        Nota del{" "}
        {formatNoteDateTime(note.created_at)}
      </time>

      {note.message_body &&
        (note.conversation_id && note.message_id ? (
          <button
            type="button"
            className="customer-note-dialog__quote customer-note-dialog__quote--link"
            onClick={() => onOpenMessage(note)}
            title="Vai al messaggio nella chat"
          >
            {note.message_body}
          </button>
        ) : (
          <blockquote className="customer-note-dialog__quote">
            {note.message_body}
          </blockquote>
        ))}

      {note.message_created_at && (
        <time
          className="customer-detail__message-date"
          dateTime={note.message_created_at}
        >
          Messaggio del{" "}
          {formatNoteDateTime(
            note.message_created_at,
          )}
        </time>
      )}

      <p
        ref={bodyRef}
        className={
          isExpanded
            ? "customer-detail__note-body"
            : "customer-detail__note-body customer-detail__note-body--collapsed"
        }
      >
        {note.body}
      </p>

      {note.clockify_time_entry_id && (
        <div className="customer-detail__timer">
          {isNoteTimerRunning(note) ? (
            <>
              <span className="customer-detail__timer-running">
                ● Timer in corso
                {note.timer_started_at &&
                  ` dalle ${formatTime(note.timer_started_at)}`}
                {note.operator_name &&
                  ` · ${note.operator_name}`}
              </span>

              <button
                type="button"
                onClick={() =>
                  void onStopTimer(note.id)
                }
                disabled={isStoppingTimer}
              >
                Ferma
              </button>
            </>
          ) : (
            <span>
              ⏱{" "}
              {formatDuration(
                note.duration_seconds ?? 0,
              )}
              {note.operator_name &&
                ` · ${note.operator_name}`}
            </span>
          )}
        </div>
      )}

      {(isTruncated || isExpanded) && (
        <button
          type="button"
          className="customer-detail__note-toggle"
          onClick={() =>
            setIsExpanded(
              (currentValue) => !currentValue,
            )
          }
          aria-expanded={isExpanded}
        >
          {isExpanded
            ? "Mostra meno"
            : "Mostra tutto"}
        </button>
      )}
    </li>
  );
}

export function CustomerDetailDialog({
  conversation,
  category,
  clockifyProject,
  notes,
  notesErrorMessage,
  onOpenChat,
  onOpenMessage,
  onClose,
}: CustomerDetailDialogProps) {
  const [noteSearch, setNoteSearch] = useState("");

  const [visibleNotesCount, setVisibleNotesCount] =
    useState(NOTES_PAGE_SIZE);

  const { customer } = conversation;

  const normalizedNoteSearch = noteSearch
    .trim()
    .toLocaleLowerCase("it-IT");

  const matchingNotes =
    normalizedNoteSearch.length === 0
      ? notes
      : notes.filter((note) =>
          [note.body, note.message_body].some(
            (value) =>
              value
                ?.toLocaleLowerCase("it-IT")
                .includes(normalizedNoteSearch),
          ),
        );

  const visibleNotes = matchingNotes.slice(
    0,
    visibleNotesCount,
  );

  const noteGroups =
    groupNotesByMonth(visibleNotes);

  const hiddenNotesCount =
    matchingNotes.length - visibleNotes.length;

  const [clockifyError, setClockifyError] =
    useState<string | null>(null);

  const { data: operators = [] } =
    useClockifyOperators();

  const { data: projects = [] } =
    useClockifyProjects(operators.length > 0);

  const setProjectMutation =
    useSetCustomerClockifyProject();

  const stopTimerMutation = useStopClockifyTimer();

  /*
   * Il progetto abbinato resta selezionabile
   * anche se l'elenco non è ancora arrivato.
   */
  const projectOptions =
    clockifyProject &&
    !projects.some(
      (project) =>
        project.id === clockifyProject.project_id,
    )
      ? [
          {
            id: clockifyProject.project_id,
            name: clockifyProject.project_name,
          },
          ...projects,
        ]
      : projects;

  const totalSeconds = notes.reduce(
    (total, note) =>
      total + (note.duration_seconds ?? 0),
    0,
  );

  const runningNotesCount = notes.filter(
    isNoteTimerRunning,
  ).length;

  async function handleProjectChange(
    projectId: string,
  ) {
    try {
      setClockifyError(null);

      await setProjectMutation.mutateAsync({
        customerId: conversation.customer_id,
        project:
          projectOptions.find(
            (project) => project.id === projectId,
          ) ?? null,
      });
    } catch (projectError) {
      setClockifyError(
        getErrorMessage(
          projectError,
          "Impossibile salvare il progetto Clockify.",
        ),
      );
    }
  }

  async function handleStopTimer(noteId: string) {
    try {
      setClockifyError(null);

      await stopTimerMutation.mutateAsync(noteId);
    } catch (stopError) {
      setClockifyError(
        getErrorMessage(
          stopError,
          "Impossibile fermare il timer.",
        ),
      );
    }
  }

  function handleNoteSearchChange(value: string) {
    setNoteSearch(value);
    setVisibleNotesCount(NOTES_PAGE_SIZE);
  }

  return (
    <div
      className="customer-detail"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="customer-detail__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-detail-title"
      >
        <div className="customer-detail__summary">
          <button
            type="button"
            className="customer-detail__close"
            onClick={onClose}
            aria-label="Chiudi scheda cliente"
            title="Chiudi"
          >
            ×
          </button>

          <div className="customer-detail__identity">
            <CustomerAvatar
              displayName={customer.display_name}
              avatarUrl={customer.avatar_url}
            />

            <div>
              <h2 id="customer-detail-title">
                {customer.display_name}
              </h2>

              {category && (
                <span className="customer-category-badge customer-category-badge--static">
                  {getCustomerCategoryLabel(category)}
                </span>
              )}
            </div>
          </div>

          <dl className="customer-detail__info">
            <div>
              <dt>Email</dt>
              <dd>
                {customer.email ? (
                  <a href={`mailto:${customer.email}`}>
                    {customer.email}
                  </a>
                ) : (
                  "Non disponibile"
                )}
              </dd>
            </div>

            <div>
              <dt>Sito web</dt>
              <dd>
                {customer.website_url ? (
                  <a
                    href={customer.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {formatWebsite(
                      customer.website_url,
                    )}
                  </a>
                ) : (
                  "Non disponibile"
                )}
              </dd>
            </div>

            <div>
              <dt>Categoria</dt>
              <dd>
                {category
                  ? getCustomerCategoryLabel(category)
                  : "Senza categoria"}
              </dd>
            </div>

            <div>
              <dt>Conversazione</dt>
              <dd>
                {
                  CONVERSATION_STATUS_LABELS[
                    conversation.status
                  ]
                }
              </dd>
            </div>

            <div>
              <dt>Prima conversazione</dt>
              <dd>
                {formatDate(conversation.created_at)}
              </dd>
            </div>

            <div>
              <dt>Ore totali</dt>
              <dd>
                {formatDuration(totalSeconds)}

                {runningNotesCount > 0 &&
                  " + timer in corso"}
              </dd>
            </div>

            {operators.length > 0 && (
              <div className="customer-detail__info-wide">
                <dt>
                  <label htmlFor="customer-clockify-project">
                    Progetto Clockify
                  </label>
                </dt>

                <dd>
                  <select
                    id="customer-clockify-project"
                    value={
                      clockifyProject?.project_id ?? ""
                    }
                    onChange={(event) =>
                      void handleProjectChange(
                        event.target.value,
                      )
                    }
                    disabled={
                      setProjectMutation.isPending
                    }
                  >
                    <option value="">
                      Automatico (stesso nome del
                      cliente)
                    </option>

                    {projectOptions.map((project) => (
                      <option
                        key={project.id}
                        value={project.id}
                      >
                        {project.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
            )}
          </dl>

          {clockifyError && (
            <p className="customer-detail__error">
              {clockifyError}
            </p>
          )}

          <div className="customer-detail__actions">
            <button
              type="button"
              className="customer-detail__open-chat"
              onClick={onOpenChat}
            >
              Apri chat
            </button>

            {clockifyProject && (
              <a
                className="customer-detail__clockify-link"
                href={getClockifyProjectUrl(
                  clockifyProject.project_id,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                Vedi attività su Clockify ↗
              </a>
            )}
          </div>

          <div className="customer-detail__notes-header">
            <h3>Note ({notes.length})</h3>

            {notes.length > 0 && (
              <input
                type="search"
                value={noteSearch}
                onChange={(event) =>
                  handleNoteSearchChange(
                    event.target.value,
                  )
                }
                placeholder="Cerca nelle note..."
                aria-label="Cerca nelle note"
                autoComplete="off"
              />
            )}
          </div>
        </div>

        <div className="customer-detail__notes-scroll">
          {notesErrorMessage && (
            <p className="customer-detail__error">
              {notesErrorMessage}
            </p>
          )}

          {!notesErrorMessage &&
            notes.length === 0 && (
              <p className="customer-detail__empty">
                Nessuna nota per questo cliente.
              </p>
            )}

          {notes.length > 0 &&
            matchingNotes.length === 0 && (
              <p className="customer-detail__empty">
                Nessuna nota corrisponde alla ricerca.
              </p>
            )}

          {noteGroups.map((group) => (
            <section
              key={group.key}
              className="customer-detail__notes-group"
            >
              <h4>{group.label}</h4>

              <ul className="customer-detail__notes">
                {group.notes.map((note) => (
                  <CustomerNoteItem
                    key={note.id}
                    note={note}
                    onOpenMessage={onOpenMessage}
                    onStopTimer={handleStopTimer}
                    isStoppingTimer={
                      stopTimerMutation.isPending
                    }
                  />
                ))}
              </ul>
            </section>
          ))}

          {hiddenNotesCount > 0 && (
            <button
              type="button"
              className="customer-detail__more"
              onClick={() =>
                setVisibleNotesCount(
                  (currentCount) =>
                    currentCount + NOTES_PAGE_SIZE,
                )
              }
            >
              Mostra altre ({hiddenNotesCount}{" "}
              {hiddenNotesCount === 1
                ? "rimanente"
                : "rimanenti"}
              )
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
