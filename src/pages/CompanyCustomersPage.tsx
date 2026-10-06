import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { CompanyConversation } from "../features/conversations/types";
import { useCompanyConversations } from "../features/conversations/useCompanyConversations";
import {
  CUSTOMER_CATEGORIES,
  getCustomerCategoryLabel,
  type CustomerCategory,
} from "../features/customers/customerCategory";
import type { CustomerNote } from "../features/customers/customerNote";
import { useCustomerCategories } from "../features/customers/useCustomerCategories";
import { useCustomerNotes } from "../features/customers/useCustomerNotes";
import { useConversationStore } from "../stores/conversationStore";

type CategoryFilter =
  | "all"
  | "none"
  | CustomerCategory;

type CustomerCard = {
  conversation: CompanyConversation;
  category: CustomerCategory | null;
  notes: CustomerNote[];
};

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

function formatDateTime(value: string) {
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

function CustomerAvatar({
  conversation,
}: {
  conversation: CompanyConversation;
}) {
  const { avatar_url, display_name } =
    conversation.customer;

  return (
    <div className="customers-avatar">
      {avatar_url ? (
        <img
          src={avatar_url}
          alt={`Avatar di ${display_name}`}
        />
      ) : (
        display_name
          .trim()
          .charAt(0)
          .toUpperCase() || "C"
      )}
    </div>
  );
}

export default function CompanyCustomersPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");

  const [selectedCustomerId, setSelectedCustomerId] =
    useState<string | null>(null);

  const selectConversation =
    useConversationStore(
      (state) => state.selectConversation,
    );

  const {
    data: conversations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useCompanyConversations();

  const { data: customerCategories = [] } =
    useCustomerCategories();

  const {
    data: customerNotes = [],
    isError: isNotesError,
    error: notesError,
  } = useCustomerNotes();

  /*
   * Una scheda per cliente: l'elenco dei clienti
   * deriva dalle conversazioni aziendali.
   */
  const customers: CustomerCard[] = [];
  const seenCustomerIds = new Set<string>();

  for (const conversation of conversations) {
    if (
      seenCustomerIds.has(conversation.customer_id)
    ) {
      continue;
    }

    seenCustomerIds.add(conversation.customer_id);

    customers.push({
      conversation,

      category:
        customerCategories.find(
          (assignment) =>
            assignment.customer_id ===
            conversation.customer_id,
        )?.category ?? null,

      notes: customerNotes.filter(
        (note) =>
          note.customer_id ===
          conversation.customer_id,
      ),
    });
  }

  customers.sort((first, second) =>
    first.conversation.customer.display_name.localeCompare(
      second.conversation.customer.display_name,
      "it-IT",
      { sensitivity: "base" },
    ),
  );

  const normalizedSearch = search
    .trim()
    .toLocaleLowerCase("it-IT");

  const filteredCustomers = customers.filter(
    ({ conversation, category }) => {
      if (
        categoryFilter !== "all" &&
        (categoryFilter === "none"
          ? category !== null
          : category !== categoryFilter)
      ) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      const { display_name, email, website_url } =
        conversation.customer;

      return [display_name, email, website_url].some(
        (value) =>
          value
            ?.toLocaleLowerCase("it-IT")
            .includes(normalizedSearch),
      );
    },
  );

  const selectedCustomer =
    customers.find(
      (customer) =>
        customer.conversation.customer_id ===
        selectedCustomerId,
    ) ?? null;

  function handleOpenChat(conversationId: string) {
    selectConversation(conversationId);
    navigate("/azienda");
  }

  return (
    <div className="customers-page">
      <header className="customers-page__header">
        <div>
          <Link
            to="/azienda"
            className="customers-page__back"
          >
            ← Conversazioni
          </Link>

          <h1>Clienti</h1>

          <p>
            {customers.length}{" "}
            {customers.length === 1
              ? "cliente"
              : "clienti"}
          </p>
        </div>

        <div className="customers-page__filters">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Cerca cliente, email o sito..."
            aria-label="Cerca clienti"
            autoComplete="off"
          />

          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(
                event.target.value as CategoryFilter,
              )
            }
            aria-label="Filtra per categoria cliente"
          >
            <option value="all">
              Tutte le categorie
            </option>

            {CUSTOMER_CATEGORIES.map((category) => (
              <option
                key={category.value}
                value={category.value}
              >
                {category.label}
              </option>
            ))}

            <option value="none">
              Senza categoria
            </option>
          </select>
        </div>
      </header>

      <main className="customers-page__content">
        {isLoading && (
          <p className="customers-page__state">
            Caricamento clienti...
          </p>
        )}

        {isError && (
          <div className="customers-page__state customers-page__state--error">
            <p>
              {getErrorMessage(
                error,
                "Impossibile recuperare i clienti.",
              )}
            </p>

            <button
              type="button"
              onClick={() => void refetch()}
            >
              Riprova
            </button>
          </div>
        )}

        {!isLoading &&
          !isError &&
          filteredCustomers.length === 0 && (
            <p className="customers-page__state">
              {customers.length === 0
                ? "Non ci sono ancora clienti."
                : "Nessun cliente corrisponde ai filtri."}
            </p>
          )}

        {!isLoading && !isError && (
          <div className="customers-grid">
            {filteredCustomers.map(
              ({ conversation, category, notes }) => (
                <button
                  key={conversation.customer_id}
                  type="button"
                  className="customer-card"
                  onClick={() =>
                    setSelectedCustomerId(
                      conversation.customer_id,
                    )
                  }
                >
                  <CustomerAvatar
                    conversation={conversation}
                  />

                  <strong className="customer-card__name">
                    {
                      conversation.customer
                        .display_name
                    }
                  </strong>

                  <span className="customer-card__email">
                    {conversation.customer.email ??
                      "Email non disponibile"}
                  </span>

                  <span className="customer-card__footer">
                    {category ? (
                      <span className="customer-category-badge customer-category-badge--static">
                        {getCustomerCategoryLabel(
                          category,
                        )}
                      </span>
                    ) : (
                      <span className="customer-card__muted">
                        Senza categoria
                      </span>
                    )}

                    <span className="customer-card__muted">
                      {notes.length}{" "}
                      {notes.length === 1
                        ? "nota"
                        : "note"}
                    </span>
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </main>

      {selectedCustomer && (
        <div
          className="customer-detail"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedCustomerId(null);
            }
          }}
        >
          <div
            className="customer-detail__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
          >
            <button
              type="button"
              className="customer-detail__close"
              onClick={() =>
                setSelectedCustomerId(null)
              }
              aria-label="Chiudi scheda cliente"
              title="Chiudi"
            >
              ×
            </button>

            <div className="customer-detail__identity">
              <CustomerAvatar
                conversation={
                  selectedCustomer.conversation
                }
              />

              <div>
                <h2 id="customer-detail-title">
                  {
                    selectedCustomer.conversation
                      .customer.display_name
                  }
                </h2>

                {selectedCustomer.category && (
                  <span className="customer-category-badge customer-category-badge--static">
                    {getCustomerCategoryLabel(
                      selectedCustomer.category,
                    )}
                  </span>
                )}
              </div>
            </div>

            <dl className="customer-detail__info">
              <div>
                <dt>Email</dt>
                <dd>
                  {selectedCustomer.conversation
                    .customer.email ? (
                    <a
                      href={`mailto:${selectedCustomer.conversation.customer.email}`}
                    >
                      {
                        selectedCustomer.conversation
                          .customer.email
                      }
                    </a>
                  ) : (
                    "Non disponibile"
                  )}
                </dd>
              </div>

              <div>
                <dt>Sito web</dt>
                <dd>
                  {selectedCustomer.conversation
                    .customer.website_url ? (
                    <a
                      href={
                        selectedCustomer.conversation
                          .customer.website_url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {formatWebsite(
                        selectedCustomer.conversation
                          .customer.website_url,
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
                  {selectedCustomer.category
                    ? getCustomerCategoryLabel(
                        selectedCustomer.category,
                      )
                    : "Senza categoria"}
                </dd>
              </div>

              <div>
                <dt>Conversazione</dt>
                <dd>
                  {
                    CONVERSATION_STATUS_LABELS[
                      selectedCustomer.conversation
                        .status
                    ]
                  }
                </dd>
              </div>

              <div>
                <dt>Prima conversazione</dt>
                <dd>
                  {formatDate(
                    selectedCustomer.conversation
                      .created_at,
                  )}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              className="customer-detail__open-chat"
              onClick={() =>
                handleOpenChat(
                  selectedCustomer.conversation.id,
                )
              }
            >
              Apri chat
            </button>

            <h3>
              Note ({selectedCustomer.notes.length})
            </h3>

            {isNotesError && (
              <p className="customer-detail__error">
                {getErrorMessage(
                  notesError,
                  "Impossibile recuperare le note.",
                )}
              </p>
            )}

            {!isNotesError &&
              selectedCustomer.notes.length === 0 && (
                <p className="customer-detail__empty">
                  Nessuna nota per questo cliente.
                </p>
              )}

            <ul className="customer-detail__notes">
              {selectedCustomer.notes.map((note) => (
                <li key={note.id}>
                  <time dateTime={note.created_at}>
                    {formatDateTime(note.created_at)}
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
          </div>
        </div>
      )}
    </div>
  );
}
