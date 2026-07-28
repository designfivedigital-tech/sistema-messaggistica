import type { CompanyConversation } from "./types";

type ConversationListProps = {
  conversations: CompanyConversation[];
  selectedConversationId: string | null;
  onSelect: (conversationId: string) => void;
};

function formatConversationTime(value: string) {
  const date = new Date(value);
  const today = new Date();

  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year:
      date.getFullYear() !== today.getFullYear()
        ? "numeric"
        : undefined,
  }).format(date);
}

function getConversationPreview(
  conversation: CompanyConversation,
) {
  if (!conversation.last_message_body) {
    return "Nessun messaggio";
  }

  return conversation.last_message_body;
}

export default function ConversationList({
  conversations,
  selectedConversationId,
  onSelect,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="conversation-list__empty">
        <p>Nessuna conversazione disponibile.</p>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conversation) => {
        const isSelected =
          conversation.id === selectedConversationId;

        const hasUnread =
          conversation.unread_count > 0;

        const initial =
          conversation.customer.display_name
            .trim()
            .charAt(0)
            .toUpperCase() || "C";

        const preview =
          getConversationPreview(conversation);

        return (
          <button
            key={conversation.id}
            type="button"
            className={[
              "conversation-item",
              isSelected
                ? "conversation-item--selected"
                : "",
              hasUnread
                ? "conversation-item--unread"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelect(conversation.id)}
          >
            <div className="conversation-item__avatar">
              {initial}
            </div>

            <div className="conversation-item__content">
              <div className="conversation-item__top">
                <strong>
                  {conversation.customer.display_name}
                </strong>

                {conversation.last_message_created_at && (
                  <time
                    dateTime={
                      conversation.last_message_created_at
                    }
                  >
                    {formatConversationTime(
                      conversation.last_message_created_at,
                    )}
                  </time>
                )}
              </div>

              <div className="conversation-item__bottom">
                <p className="conversation-item__preview">
                  {preview}
                </p>

                {hasUnread && (
                  <span
                    className="conversation-item__badge"
                    aria-label={`${conversation.unread_count} messaggi non letti`}
                    title={`${conversation.unread_count} messaggi non letti`}
                  >
                    {conversation.unread_count > 99
                      ? "99+"
                      : conversation.unread_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}