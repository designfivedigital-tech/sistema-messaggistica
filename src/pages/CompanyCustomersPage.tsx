import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { CompanySectionTabs } from "../features/customers/CompanySectionTabs";
import type { CompanyConversation } from "../features/conversations/types";
import { useCompanyConversations } from "../features/conversations/useCompanyConversations";
import { CustomerAvatar } from "../features/customers/CustomerAvatar";
import { CustomerDetailDialog } from "../features/customers/CustomerDetailDialog";
import {
  CUSTOMER_CATEGORIES,
  getCustomerCategoryLabel,
  type CustomerCategory,
} from "../features/customers/customerCategory";
import {
  isNoteTimerRunning,
  type CustomerNote,
} from "../features/customers/customerNote";
import { ClockifySettingsDialog } from "../features/clockify/ClockifySettingsDialog";
import {
  useClockifyTimerSync,
  useCustomerClockifyProjects,
} from "../features/clockify/useClockify";
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

export default function CompanyCustomersPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");

  const [selectedCustomerId, setSelectedCustomerId] =
    useState<string | null>(null);

  const [
    isClockifySettingsOpen,
    setIsClockifySettingsOpen,
  ] = useState(false);

  const selectConversation =
    useConversationStore(
      (state) => state.selectConversation,
    );

  const focusMessage = useConversationStore(
    (state) => state.focusMessage,
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

  const { data: customerClockifyProjects = [] } =
    useCustomerClockifyProjects();

  useClockifyTimerSync(
    customerNotes.some(isNoteTimerRunning),
  );

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
          <CompanySectionTabs />

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

          <button
            type="button"
            className="customers-page__clockify"
            onClick={() =>
              setIsClockifySettingsOpen(true)
            }
          >
            Clockify
          </button>
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
                    displayName={
                      conversation.customer
                        .display_name
                    }
                    avatarUrl={
                      conversation.customer.avatar_url
                    }
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

      {isClockifySettingsOpen && (
        <ClockifySettingsDialog
          onClose={() =>
            setIsClockifySettingsOpen(false)
          }
        />
      )}

      {selectedCustomer && (
        <CustomerDetailDialog
          key={
            selectedCustomer.conversation.customer_id
          }
          conversation={selectedCustomer.conversation}
          category={selectedCustomer.category}
          clockifyProject={
            customerClockifyProjects.find(
              (project) =>
                project.customer_id ===
                selectedCustomer.conversation
                  .customer_id,
            ) ?? null
          }
          notes={selectedCustomer.notes}
          notesErrorMessage={
            isNotesError
              ? getErrorMessage(
                  notesError,
                  "Impossibile recuperare le note.",
                )
              : null
          }
          onOpenChat={() =>
            handleOpenChat(
              selectedCustomer.conversation.id,
            )
          }
          onOpenMessage={(note) => {
            if (
              !note.conversation_id ||
              !note.message_id
            ) {
              return;
            }

            focusMessage(
              note.conversation_id,
              note.message_id,
            );

            navigate("/azienda");
          }}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
}
