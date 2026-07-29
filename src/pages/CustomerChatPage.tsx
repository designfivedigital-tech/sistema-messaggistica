import { useNavigate } from "react-router-dom";
import { useMarkMessagesRead } from "../features/messages/useMarkMessagesRead";
import { logoutUser } from "../features/auth/authService";
import { useAuth } from "../features/auth/useAuth";
import { useProfile } from "../features/auth/useProfile";
import { useCustomerConversation } from "../features/conversations/useCustomerConversation";
import MessageComposer from "../features/messages/MessageComposer";
import MessageList from "../features/messages/MessageList";
import { useMessages } from "../features/messages/useMessages";
import { useMessagesRealtime } from "../features/messages/useMessagesRealtime";
import { useConversationStore } from "../stores/conversationStore";
import { useTypingPresence } from "../features/messages/useTypingPresence";
import { PushNotificationButton } from "../features/notifications/PushNotificationButton";


export default function CustomerChatPage() {
  const navigate = useNavigate();

  const { user } = useAuth();
  const { data: profile } = useProfile(
    Boolean(user),
  );

  const {
    data: conversation,
    isLoading: isConversationLoading,
    isError: isConversationError,
    error: conversationError,
  } = useCustomerConversation();

  const conversationId =
    conversation?.id ?? null;

  const {
    data: messages = [],
    isLoading: isMessagesLoading,
  } = useMessages(conversationId);

  useMessagesRealtime(conversationId);
  useMarkMessagesRead(conversationId);

  const {
  onlineUsers,
  typingUsers,
  setTyping,
} = useTypingPresence({
  conversationId,
  currentUserId: user?.id ?? null,
  displayName:
    profile?.display_name ??
    user?.email ??
    "Cliente",
  role: profile?.role ?? "customer",
  enabled: Boolean(
    conversationId &&
      user &&
      profile,
  ),
});

const companyIsTyping = typingUsers.some(
  (typingUser) =>
    typingUser.role === "company",
);

const companyIsOnline = onlineUsers.some(
  (onlineUser) =>
    onlineUser.role === "company",
);

  async function handleLogout() {
    try {
      await logoutUser();

      useConversationStore
        .getState()
        .clearSelectedConversation();

      navigate("/login", { replace: true });
    } catch (error) {
      console.error(
        "Errore durante il logout:",
        error,
      );
    }
  }

  if (isConversationLoading) {
    return (
      <main className="loading-page">
        <p>Caricamento conversazione...</p>
      </main>
    );
  }

  if (isConversationError || !conversation) {
    return (
      <main>
        <h1>Errore conversazione</h1>

        <p>
          {conversationError instanceof Error
            ? conversationError.message
            : "Conversazione non disponibile."}
        </p>
      </main>
    );
  }

  return (
    <div className="customer-chat">
      <header className="customer-chat__header">
        <div className="customer-chat__identity">
          <div className="customer-chat__avatar">
            <img src="/fivedigital--logo.jpg" alt="logo-five" />
          </div>

          <div>
            <span>Chatta con</span>
            <h1>Five Digital</h1>
            {companyIsTyping ? (
            <p className="typing-indicator">
              <span className="typing-indicator__dots">
                <span />
                <span />
                <span />
              </span>

              L’azienda sta scrivendo...
            </p>
          ) : companyIsOnline ? (
            <p className="presence-status presence-status--online">
              <span className="presence-status__dot" />

              Online
            </p>
          ) : (
            <p className="presence-status">
              Assistenza
            </p>
          )}
          </div>
        </div>

        <div className="customer-chat__actions">

          <button
            type="button"
            className="customer-chat__profile"
            onClick={() => navigate("/profilo")}
          >
            Profilo
          </button>
          <PushNotificationButton />

          <button
            type="button"
            className="customer-chat__logout"
            onClick={handleLogout}
          >
            Esci
          </button>
        </div>
      </header>

      <main className="customer-chat__body">
        <MessageList
          messages={messages}
          currentUserId={user?.id ?? ""}
          isLoading={isMessagesLoading}
        />

        <MessageComposer
          conversationId={conversation.id}
          senderId={user?.id ?? ""}
          onTypingChange={setTyping}
        />
      </main>
    </div>
  );
}