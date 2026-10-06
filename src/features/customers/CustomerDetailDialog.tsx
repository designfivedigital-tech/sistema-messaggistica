import { useState } from "react";

import type { CompanyConversation } from "../conversations/types";
import { CustomerAvatar } from "./CustomerAvatar";
import {
  getCustomerCategoryLabel,
  type CustomerCategory,
} from "./customerCategory";
import type { CustomerNote } from "./customerNote";

type CustomerDetailDialogProps = {
  conversation: CompanyConversation;
  category: CustomerCategory | null;

  /* Ordinate dalla più recente alla meno recente. */
  notes: CustomerNote[];
  notesErrorMessage: string | null;

  onOpenChat: () => void;
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
    weekday: "short",
    day: "2-digit",
    month: "long",
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

export function CustomerDetailDialog({
  conversation,
  category,
  notes,
  notesErrorMessage,
  onOpenChat,
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
          </dl>

          <button
            type="button"
            className="customer-detail__open-chat"
            onClick={onOpenChat}
          >
            Apri chat
          </button>

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
                  <li key={note.id}>
                    <time dateTime={note.created_at}>
                      {formatNoteDateTime(
                        note.created_at,
                      )}
                    </time>

                    {note.message_body && (
                      <blockquote className="customer-note-dialog__quote">
                        {note.message_body}
                      </blockquote>
                    )}

                    <p>{note.body}</p>
                  </li>
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
