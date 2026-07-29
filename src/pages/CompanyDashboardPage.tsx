import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useUpdateConversationStatus } from "../features/conversations/useUpdateConversationStatus";
import type {
  ConversationStatus,
} from "../features/conversations/types";
import { logoutUser } from "../features/auth/authService";
import { useAuth } from "../features/auth/useAuth";
import { useProfile } from "../features/auth/useProfile";
import ConversationList from "../features/conversations/ConversationList";
import { useCompanyConversations } from "../features/conversations/useCompanyConversations";
import MessageComposer from "../features/messages/MessageComposer";
import MessageList from "../features/messages/MessageList";
import { useMarkMessagesRead } from "../features/messages/useMarkMessagesRead";
import { useMessages } from "../features/messages/useMessages";
import { useMessagesRealtime } from "../features/messages/useMessagesRealtime";
import { useTypingPresence } from "../features/messages/useTypingPresence";
import { PushNotificationButton } from "../features/notifications/PushNotificationButton";
import { useConversationStore } from "../stores/conversationStore";
import { useDeleteConversation } from "../features/conversations/useDeleteConversation";


const MOBILE_MEDIA_QUERY = "(max-width: 760px)";

type ConversationFilter =
  | "all"
  | ConversationStatus;

export default function CompanyDashboardPage() {
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(
      MOBILE_MEDIA_QUERY,
    ).matches;
  });

  const [isMobileChatOpen, setIsMobileChatOpen] =
    useState(false);

    const [isConversationMenuOpen, setIsConversationMenuOpen] =
  useState(false);

  const [conversationFilter, setConversationFilter] =
  useState<ConversationFilter>("all");

  const [conversationSearch, setConversationSearch] =
  useState("");

  const [
  isDeleteConversationDialogOpen,
  setIsDeleteConversationDialogOpen,
] = useState(false);

const [
  deleteConversationConfirmation,
  setDeleteConversationConfirmation,
] = useState("");

const [
  deleteConversationError,
  setDeleteConversationError,
] = useState<string | null>(null);

const conversationMenuRef =
  useRef<HTMLDivElement | null>(null);

  const { user } = useAuth();
  const { data: profile } = useProfile();

  const {
    data: conversations = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useCompanyConversations();

  const conversationCounts = {
  all: conversations.length,

  new: conversations.filter(
    (conversation) =>
      conversation.status === "new",
  ).length,

  in_progress: conversations.filter(
    (conversation) =>
      conversation.status === "in_progress",
  ).length,

  closed: conversations.filter(
    (conversation) =>
      conversation.status === "closed",
  ).length,
};

const normalizedConversationSearch =
  conversationSearch.trim().toLocaleLowerCase("it-IT");

const conversationsFilteredByStatus =
  conversationFilter === "all"
    ? conversations
    : conversations.filter(
        (conversation) =>
          conversation.status ===
          conversationFilter,
      );

const filteredConversations =
  normalizedConversationSearch.length === 0
    ? conversationsFilteredByStatus
    : conversationsFilteredByStatus.filter(
        (conversation) => {
          const displayName =
            conversation.customer.display_name
              ?.toLocaleLowerCase("it-IT") ?? "";

          const email =
            conversation.customer.email
              ?.toLocaleLowerCase("it-IT") ?? "";

          const lastMessage =
            conversation.last_message_body
              ?.toLocaleLowerCase("it-IT") ?? "";

          return (
            displayName.includes(
              normalizedConversationSearch,
            ) ||
            email.includes(
              normalizedConversationSearch,
            ) ||
            lastMessage.includes(
              normalizedConversationSearch,
            )
          );
        },
      );

  const updateConversationStatusMutation =
  useUpdateConversationStatus();

  const deleteConversationMutation =
  useDeleteConversation();

  const selectedConversationId =
    useConversationStore(
      (state) => state.selectedConversationId,
    );

  const selectConversation =
    useConversationStore(
      (state) => state.selectConversation,
    );

  const clearSelectedConversation =
    useConversationStore(
      (state) => state.clearSelectedConversation,
    );

  const selectedConversation =
    conversations.find(
      (conversation) =>
        conversation.id ===
        selectedConversationId,
    );

  const {
    data: messages = [],
    isLoading: isMessagesLoading,
  } = useMessages(selectedConversationId);

  useMessagesRealtime(selectedConversationId);
  useMarkMessagesRead(selectedConversationId);

  const {
    onlineUsers,
    typingUsers,
    setTyping,
  } = useTypingPresence({
    conversationId: selectedConversationId,
    currentUserId: user?.id ?? null,
    displayName:
      profile?.display_name ??
      user?.email ??
      "Operatore",
    role: profile?.role ?? "company",
    enabled: Boolean(
      selectedConversationId &&
        user &&
        profile,
    ),
  });

  /*
   * Rileva il passaggio tra desktop e mobile.
   * Quando si entra nella modalità mobile,
   * viene sempre mostrata inizialmente la lista.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      MOBILE_MEDIA_QUERY,
    );

    function handleViewportChange(
      event: MediaQueryListEvent,
    ) {
      setIsMobile(event.matches);

      if (event.matches) {
        setIsMobileChatOpen(false);
      }
    }

    setIsMobile(mediaQuery.matches);

    mediaQuery.addEventListener(
      "change",
      handleViewportChange,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleViewportChange,
      );
    };
  }, []);

  /*
   * Su desktop seleziona automaticamente
   * la prima conversazione.
   *
   * Su smartphone non apre automaticamente
   * nessuna chat.
   */
  useEffect(() => {
  if (
    isMobile ||
    filteredConversations.length === 0 ||
    selectedConversationId
  ) {
    return;
  }

  selectConversation(
    filteredConversations[0].id,
  );
}, [
  filteredConversations,
  isMobile,
  selectedConversationId,
  selectConversation,
]);

  /*
   * Gestisce una conversazione selezionata
   * che non esiste più nell'elenco.
   */
  useEffect(() => {
    if (
      !selectedConversationId ||
      conversations.length === 0 ||
      selectedConversation
    ) {
      return;
    }

    if (isMobile) {
      clearSelectedConversation();
      setIsMobileChatOpen(false);
      return;
    }

    selectConversation(conversations[0].id);
  }, [
    clearSelectedConversation,
    conversations,
    isMobile,
    selectedConversation,
    selectedConversationId,
    selectConversation,
  ]);

  /*
   * Se non esistono più conversazioni,
   * rimuove l'eventuale selezione precedente.
   */
  useEffect(() => {
    if (
      isLoading ||
      conversations.length > 0 ||
      !selectedConversationId
    ) {
      return;
    }

    clearSelectedConversation();
    setIsMobileChatOpen(false);
  }, [
    clearSelectedConversation,
    conversations.length,
    isLoading,
    selectedConversationId,
  ]);

  useEffect(() => {
  if (!isConversationMenuOpen) {
    return;
  }

  function handleDocumentClick(
    event: MouseEvent,
  ) {
    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    if (
      conversationMenuRef.current?.contains(
        target,
      )
    ) {
      return;
    }

    setIsConversationMenuOpen(false);
  }

  document.addEventListener(
    "mousedown",
    handleDocumentClick,
  );

  return () => {
    document.removeEventListener(
      "mousedown",
      handleDocumentClick,
    );
  };
}, [isConversationMenuOpen]);


  function handleConversationFilterChange(
  filter: ConversationFilter,
) {
  setConversationFilter(filter);
  setIsConversationMenuOpen(false);

  const conversationsMatchingStatus =
  filter === "all"
    ? conversations
    : conversations.filter(
        (conversation) =>
          conversation.status === filter,
      );

const normalizedSearch =
  conversationSearch.trim().toLocaleLowerCase("it-IT");

const nextConversations =
  normalizedSearch.length === 0
    ? conversationsMatchingStatus
    : conversationsMatchingStatus.filter(
        (conversation) => {
          const displayName =
            conversation.customer.display_name
              ?.toLocaleLowerCase("it-IT") ?? "";

          const email =
            conversation.customer.email
              ?.toLocaleLowerCase("it-IT") ?? "";

          const lastMessage =
            conversation.last_message_body
              ?.toLocaleLowerCase("it-IT") ?? "";

          return (
            displayName.includes(normalizedSearch) ||
            email.includes(normalizedSearch) ||
            lastMessage.includes(normalizedSearch)
          );
        },
      );

  if (isMobile) {
    clearSelectedConversation();
    setIsMobileChatOpen(false);
    return;
  }

  const selectedIsVisible =
    nextConversations.some(
      (conversation) =>
        conversation.id ===
        selectedConversationId,
    );

  if (selectedIsVisible) {
    return;
  }

  if (nextConversations.length > 0) {
    selectConversation(
      nextConversations[0].id,
    );
  } else {
    clearSelectedConversation();
  }
}

  function handleSelectConversation(
  conversationId: string,
) {
  setIsConversationMenuOpen(false);
  selectConversation(conversationId);

  if (isMobile) {
    setIsMobileChatOpen(true);
  }
}

  function handleMobileBack() {
  setIsConversationMenuOpen(false);
  setIsMobileChatOpen(false);
  clearSelectedConversation();
}

  async function handleConversationStatusChange(
  status: ConversationStatus,
) {
  if (!selectedConversation) {
    return;
  }

  try {
    setIsConversationMenuOpen(false);

    await updateConversationStatusMutation.mutateAsync({
      conversationId:
        selectedConversation.id,
      status,
    });
  } catch (statusError) {
    console.error(
      "Impossibile aggiornare lo stato:",
      statusError,
    );
  }
}

  function handleOpenDeleteConversationDialog() {
  setIsConversationMenuOpen(false);
  setDeleteConversationConfirmation("");
  setDeleteConversationError(null);
  setIsDeleteConversationDialogOpen(true);
}

function handleCloseDeleteConversationDialog() {
  if (deleteConversationMutation.isPending) {
    return;
  }

  setIsDeleteConversationDialogOpen(false);
  setDeleteConversationConfirmation("");
  setDeleteConversationError(null);
}

async function handleDeleteConversation() {
  if (
    !selectedConversation ||
    deleteConversationConfirmation !== "ELIMINA"
  ) {
    return;
  }

  try {
    setDeleteConversationError(null);

    const deletedConversationId =
      selectedConversation.id;

    await deleteConversationMutation.mutateAsync({
      conversationId: deletedConversationId,
    });

    clearSelectedConversation();
    setIsMobileChatOpen(false);
    setIsDeleteConversationDialogOpen(false);
    setDeleteConversationConfirmation("");
  } catch (deleteError) {
    console.error(
      "Errore durante l'eliminazione della conversazione:",
      deleteError,
    );

    setDeleteConversationError(
      deleteError instanceof Error
        ? deleteError.message
        : "Impossibile eliminare la conversazione.",
    );
  }
}

  async function handleLogout() {
    try {
      await logoutUser();
      clearSelectedConversation();

      navigate("/login", {
        replace: true,
      });
    } catch (logoutError) {
      console.error(
        "Errore durante il logout:",
        logoutError,
      );
    }
  }

  function getCompanyTypingLabel() {
    if (typingUsers.length === 0) {
      return null;
    }

    const customersTyping =
      typingUsers.filter(
        (typingUser) =>
          typingUser.role === "customer",
      );

    const operatorsTyping =
      typingUsers.filter(
        (typingUser) =>
          typingUser.role === "company",
      );

    const names = [
      ...customersTyping.map(
        (typingUser) =>
          typingUser.displayName ||
          "Il cliente",
      ),
      ...operatorsTyping.map(
        (typingUser) =>
          typingUser.displayName ||
          "Un operatore",
      ),
    ];

    if (names.length === 1) {
      return `${names[0]} sta scrivendo...`;
    }

    if (names.length === 2) {
      return `${names[0]} e ${names[1]} stanno scrivendo...`;
    }

    return `${names[0]}, ${names[1]} e altri ${
      names.length - 2
    } stanno scrivendo...`;
  }

  const typingLabel =
    getCompanyTypingLabel();

  const customerIsOnline =
    onlineUsers.some(
      (onlineUser) =>
        onlineUser.role === "customer",
    );

  return (
    <div className="company-dashboard">
      <header className="company-header">
        <div className="company-header__identity">
          <span className="company-header__eyebrow">
            Sistema Messaggistica
          </span>

          <h1>Conversazioni clienti</h1>

          <p>
            Operatore:{" "}
            <strong>
              {profile?.display_name ??
                "Azienda"}
            </strong>
          </p>
        </div>

        <div className="company-header__actions">
          <button
            type="button"
            className="company-header__profile"
            onClick={() => navigate("/profilo")}
          >
            Profilo
          </button>
          <PushNotificationButton />

          <button
            type="button"
            className="company-header__logout"
            onClick={handleLogout}
          >
            Esci
          </button>
        </div>
      </header>

      <main
        className={[
          "company-layout",
          isMobileChatOpen
            ? "company-layout--chat-open"
            : "company-layout--list-open",
        ].join(" ")}
      >
        <aside className="company-sidebar">
          <div className="company-sidebar__header">
            <div>
              <h2>Messaggi</h2>

              <span>
                {conversations.length}{" "}
                {conversations.length === 1
                  ? "conversazione"
                  : "conversazioni"}
              </span>
            </div>

            <button
              type="button"
              className={[
                "company-sidebar__refresh",
                isFetching
                  ? "company-sidebar__refresh--loading"
                  : "",
              ].join(" ")}
              onClick={() => void refetch()}
              aria-label="Aggiorna conversazioni"
              title="Aggiorna"
              disabled={isFetching}
            >
              ↻
            </button>
          </div>

          <div className="conversation-search">
            <span
              className="conversation-search__icon"
              aria-hidden="true"
            >
              ⌕
            </span>

            <input
              type="search"
              value={conversationSearch}
              onChange={(event) =>
                setConversationSearch(event.target.value)
              }
              placeholder="Cerca cliente, email o messaggio..."
              aria-label="Cerca conversazioni"
              autoComplete="off"
            />

            {conversationSearch.length > 0 && (
              <button
                type="button"
                className="conversation-search__clear"
                onClick={() =>
                  setConversationSearch("")
                }
                aria-label="Cancella ricerca"
                title="Cancella ricerca"
              >
                ×
              </button>
            )}
          </div>

          <div
            className="conversation-filters"
            role="group"
            aria-label="Filtra conversazioni"
          >
            <button
              type="button"
              className={[
                "conversation-filters__button",
                conversationFilter === "all"
                  ? "conversation-filters__button--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                handleConversationFilterChange(
                  "all",
                )
              }
            >
              <span>Tutte</span>
              <strong>
                {conversationCounts.all}
              </strong>
            </button>

            <button
              type="button"
              className={[
                "conversation-filters__button",
                conversationFilter === "new"
                  ? "conversation-filters__button--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                handleConversationFilterChange(
                  "new",
                )
              }
            >
              <span>Nuove</span>
              <strong>
                {conversationCounts.new}
              </strong>
            </button>

            <button
              type="button"
              className={[
                "conversation-filters__button",
                conversationFilter ===
                "in_progress"
                  ? "conversation-filters__button--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                handleConversationFilterChange(
                  "in_progress",
                )
              }
            >
              <span>In lavorazione</span>
              <strong>
                {conversationCounts.in_progress}
              </strong>
            </button>

            <button
              type="button"
              className={[
                "conversation-filters__button",
                conversationFilter === "closed"
                  ? "conversation-filters__button--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                handleConversationFilterChange(
                  "closed",
                )
              }
            >
              <span>Chiuse</span>
              <strong>
                {conversationCounts.closed}
              </strong>
            </button>
          </div>

          {isLoading && (
            <div className="company-state">
              <p>
                Caricamento conversazioni...
              </p>
            </div>
          )}

          {isError && (
            <div className="company-state company-state--error">
              <p>
                {typeof error === "object" &&
                error !== null &&
                "message" in error
                  ? String(error.message)
                  : "Impossibile recuperare le conversazioni."}
              </p>

              <button
                type="button"
                onClick={() =>
                  void refetch()
                }
              >
                Riprova
              </button>
            </div>
          )}

          {!isLoading && !isError && (
            <ConversationList
              conversations={filteredConversations}
              selectedConversationId={
                selectedConversationId
              }
              onSelect={
                handleSelectConversation
              }
            />
          )}
        </aside>

        <section className="company-chat-panel">
          {selectedConversation ? (
            <>
              <header className="company-chat-panel__header">
                <button
                  type="button"
                  className="company-chat-panel__back"
                  onClick={handleMobileBack}
                  aria-label="Torna alle conversazioni"
                  title="Torna alle conversazioni"
                >
                  ←
                </button>

                <div className="company-chat-panel__avatar">
                  {selectedConversation.customer.avatar_url ? (
                    <img
                      src={selectedConversation.customer.avatar_url}
                      alt={`Avatar di ${selectedConversation.customer.display_name}`}
                    />
                  ) : (
                    selectedConversation.customer.display_name
                      .trim()
                      .charAt(0)
                      .toUpperCase() || "C"
                  )}
                </div>

                <div className="company-chat-panel__identity">
                  <h2>
                    {
                      selectedConversation
                        .customer.display_name
                    }
                  </h2>

                  {selectedConversation.customer.website_url && (
                    <a
                      className="company-chat-panel__website"
                      href={
                        selectedConversation.customer.website_url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selectedConversation.customer.website_url}
                    </a>
                  )}

                  {typingLabel ? (
                    <p className="typing-indicator">
                      <span className="typing-indicator__dots">
                        <span />
                        <span />
                        <span />
                      </span>

                      {typingLabel}
                    </p>
                  ) : customerIsOnline ? (
                    <p className="presence-status presence-status--online">
                      <span className="presence-status__dot" />

                      Online
                    </p>
                  ) : (
                    <p className="presence-status">
                      Conversazione{" "}
                      {selectedConversation.status === "new"
                        ? "nuova"
                        : selectedConversation.status ===
                            "in_progress"
                          ? "in lavorazione"
                          : "chiusa"}
                    </p>
                  )}
                </div>
                
                <div
                  className="conversation-actions"
                  ref={conversationMenuRef}
                >
                  <button
                    type="button"
                    className="conversation-actions__trigger"
                    onClick={() =>
                      setIsConversationMenuOpen(
                        (currentValue) =>
                          !currentValue,
                      )
                    }
                    aria-label="Azioni conversazione"
                    aria-expanded={
                      isConversationMenuOpen
                    }
                    title="Azioni conversazione"
                    disabled={
                      updateConversationStatusMutation.isPending
                    }
                  >
                    ⋮
                  </button>

                  {isConversationMenuOpen && (
                    <div
                      className="conversation-actions__menu"
                      role="menu"
                    >
                      {selectedConversation.status ===
                        "new" && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            void handleConversationStatusChange(
                              "in_progress",
                            )
                          }
                        >
                          Prendi in carico
                        </button>
                      )}

                      {selectedConversation.status !==
                        "closed" && (
                        <button
                          type="button"
                          role="menuitem"
                          className="conversation-actions__danger"
                          onClick={() =>
                            void handleConversationStatusChange(
                              "closed",
                            )
                          }
                        >
                          Chiudi conversazione
                        </button>
                      )}

                      {selectedConversation.status ===
                        "closed" && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            void handleConversationStatusChange(
                              "in_progress",
                            )
                          }
                        >
                          Riapri conversazione
                        </button>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        className="conversation-actions__danger"
                        onClick={
                          handleOpenDeleteConversationDialog
                        }
                      >
                        Elimina conversazione
                      </button>
                    </div>
                  )}
                </div>

              </header>

              <div className="company-chat-panel__messages">
                <MessageList
                  messages={messages}
                  currentUserId={
                    user?.id ?? ""
                  }
                  isLoading={
                    isMessagesLoading
                  }
                />

                <MessageComposer
                  conversationId={
                    selectedConversation.id
                  }
                  senderId={user?.id ?? ""}
                  onTypingChange={setTyping}
                />
              </div>
            </>
          ) : (
            <div className="company-chat-panel__placeholder">
              <div>
                <h2>
                  Nessuna conversazione
                  selezionata
                </h2>

                <p>
                  Seleziona un cliente
                  dall’elenco.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

        {isDeleteConversationDialogOpen &&
  selectedConversation && (
    <div
      className="conversation-delete-dialog"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleCloseDeleteConversationDialog();
        }
      }}
    >
      <div
        className="conversation-delete-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-conversation-title"
      >
        <h2 id="delete-conversation-title">
          Elimina definitivamente la conversazione?
        </h2>

        <p>
          Verranno eliminati tutti i messaggi,
          le reazioni e gli allegati della conversazione
          con{" "}
          <strong>
            {
              selectedConversation.customer
                .display_name
            }
          </strong>
          .
        </p>

        <p>
          Questa operazione non può essere annullata.
          Per confermare, digita:
        </p>

        <strong className="conversation-delete-dialog__confirmation-word">
          ELIMINA
        </strong>

        <input
          type="text"
          value={deleteConversationConfirmation}
          onChange={(event) =>
            setDeleteConversationConfirmation(
              event.target.value.toUpperCase(),
            )
          }
          placeholder="Scrivi ELIMINA"
          autoComplete="off"
          disabled={
            deleteConversationMutation.isPending
          }
        />

        {deleteConversationError && (
          <p className="conversation-delete-dialog__error">
            {deleteConversationError}
          </p>
        )}

        <div className="conversation-delete-dialog__actions">
          <button
            type="button"
            className="conversation-delete-dialog__cancel"
            onClick={
              handleCloseDeleteConversationDialog
            }
            disabled={
              deleteConversationMutation.isPending
            }
          >
            Annulla
          </button>

          <button
            type="button"
            className="conversation-delete-dialog__confirm"
            onClick={() =>
              void handleDeleteConversation()
            }
            disabled={
              deleteConversationConfirmation !==
                "ELIMINA" ||
              deleteConversationMutation.isPending
            }
          >
            {deleteConversationMutation.isPending
              ? "Eliminazione..."
              : "Elimina definitivamente"}
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}