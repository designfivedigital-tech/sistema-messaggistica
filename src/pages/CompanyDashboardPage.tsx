import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PushNotificationButton } from "../features/notifications/PushNotificationButton";
import { logoutUser } from "../features/auth/authService";
import { useAuth } from "../features/auth/useAuth";
import { useProfile } from "../features/auth/useProfile";

import ConversationList from "../features/conversations/ConversationList";
import { useCompanyConversations } from "../features/conversations/useCompanyConversations";
import { useTypingPresence } from "../features/messages/useTypingPresence";
import MessageComposer from "../features/messages/MessageComposer";
import MessageList from "../features/messages/MessageList";
import { useMessages } from "../features/messages/useMessages";
import { useMessagesRealtime } from "../features/messages/useMessagesRealtime";
import { useMarkMessagesRead } from "../features/messages/useMarkMessagesRead";
import { useConversationStore } from "../stores/conversationStore";

export default function CompanyDashboardPage() {
  const navigate = useNavigate();

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

  const selectedConversationId = useConversationStore(
    (state) => state.selectedConversationId,
  );

  const selectConversation = useConversationStore(
    (state) => state.selectConversation,
  );

  const clearSelectedConversation = useConversationStore(
    (state) => state.clearSelectedConversation,
  );

  const selectedConversation = conversations.find(
    (conversation) =>
      conversation.id === selectedConversationId,
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

  useEffect(() => {
    if (
      conversations.length > 0 &&
      !selectedConversationId
    ) {
      selectConversation(conversations[0].id);
    }
  }, [
    conversations,
    selectedConversationId,
    selectConversation,
  ]);

  useEffect(() => {
    if (
      selectedConversationId &&
      conversations.length > 0 &&
      !selectedConversation
    ) {
      selectConversation(conversations[0].id);
    }
  }, [
    conversations,
    selectedConversation,
    selectedConversationId,
    selectConversation,
  ]);

  async function handleLogout() {
    try {
      await logoutUser();
      clearSelectedConversation();
      navigate("/login", { replace: true });
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

  const customersTyping = typingUsers.filter(
    (typingUser) =>
      typingUser.role === "customer",
  );

  const operatorsTyping = typingUsers.filter(
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

const typingLabel = getCompanyTypingLabel();

const customerIsOnline = onlineUsers.some(
  (onlineUser) =>
    onlineUser.role === "customer",
);

  return (
    <div className="company-dashboard">
      <header className="company-header">
        <div>
          <span className="company-header__eyebrow">
            Sistema Messaggistica
          </span>

          <h1>Conversazioni clienti</h1>

          <p>
            Operatore:{" "}
            <strong>
              {profile?.display_name ?? "Azienda"}
            </strong>
          </p>
        </div>

        <div className="company-header__actions">
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

      <main className="company-layout">
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
              className={`company-sidebar__refresh ${
                isFetching
                  ? "company-sidebar__refresh--loading"
                  : ""
              }`}
              onClick={() => void refetch()}
              aria-label="Aggiorna conversazioni"
              title="Aggiorna"
              disabled={isFetching}
            >
              ↻
            </button>
          </div>

          {isLoading && (
            <div className="company-state">
              <p>Caricamento conversazioni...</p>
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
                onClick={() => void refetch()}
              >
                Riprova
              </button>
            </div>
          )}

          {!isLoading && !isError && (
            <ConversationList
              conversations={conversations}
              selectedConversationId={
                selectedConversationId
              }
              onSelect={selectConversation}
            />
          )}
        </aside>

        <section className="company-chat-panel">
          {selectedConversation ? (
            <>
              <header className="company-chat-panel__header">
                <div className="company-chat-panel__avatar">
                  {selectedConversation.customer.display_name
                    .trim()
                    .charAt(0)
                    .toUpperCase() || "C"}
                </div>

                <div>
                  <h2>
                    {
                      selectedConversation.customer
                        .display_name
                    }
                  </h2>

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
                    {selectedConversation.status === "open"
                      ? "aperta"
                      : "chiusa"}
                  </p>
                )}
                </div>
              </header>

              <div className="company-chat-panel__messages">
                <MessageList
                  messages={messages}
                  currentUserId={user?.id ?? ""}
                  isLoading={isMessagesLoading}
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
                  Nessuna conversazione selezionata
                </h2>

                <p>
                  Seleziona un cliente dall’elenco.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}