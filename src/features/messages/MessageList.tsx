import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";

import MessageAttachment from "./MessageAttachment";
import { useDeleteMessage } from "./useDeleteMessage";
import { useRemoveMessageReaction } from "./useRemoveMessageReaction";
import { useReplyStore } from "./replyStore";
import { useSetMessageReaction } from "./useSetMessageReaction";

import type {
  ChatMessage,
  ChatReaction,
} from "./types";

type MessageListProps = {
  messages: ChatMessage[];
  currentUserId: string;
  isLoading: boolean;
};

type ReactionGroup = {
  emoji: string;
  count: number;
  reactions: ChatReaction[];
  includesCurrentUser: boolean;
};

const REACTION_OPTIONS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
] as const;

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDayLabel(value: string) {
  const messageDate = new Date(value);
  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();

  if (isSameDay(messageDate, today)) {
    return "Oggi";
  }

  if (isSameDay(messageDate, yesterday)) {
    return "Ieri";
  }

  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year:
      messageDate.getFullYear() !==
      today.getFullYear()
        ? "numeric"
        : undefined,
  }).format(messageDate);
}

function getDateKey(value: string) {
  const date = new Date(value);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function escapeRegExp(value: string) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase("it-IT")
    .trim();
}

function highlightSearchText(
  text: string,
  searchQuery: string,
): ReactNode {
  const normalizedQuery = searchQuery.trim();

  if (!normalizedQuery) {
    return text;
  }

  const expression = new RegExp(
    `(${escapeRegExp(normalizedQuery)})`,
    "gi",
  );

  return text
    .split(expression)
    .map((part, index) => {
      const isMatch =
        part.toLocaleLowerCase("it-IT") ===
        normalizedQuery.toLocaleLowerCase(
          "it-IT",
        );

      if (!isMatch) {
        return part;
      }

      return (
        <mark
          key={`${part}-${index}`}
          className="message-search-highlight"
        >
          {part}
        </mark>
      );
    });
}

function groupMessageReactions(
  reactions: ChatReaction[],
  currentUserId: string,
): ReactionGroup[] {
  const groups = new Map<
    string,
    ReactionGroup
  >();

  for (const reaction of reactions) {
    const existingGroup = groups.get(
      reaction.emoji,
    );

    if (existingGroup) {
      existingGroup.count += 1;
      existingGroup.reactions.push(reaction);

      if (
        reaction.user_id === currentUserId
      ) {
        existingGroup.includesCurrentUser =
          true;
      }

      continue;
    }

    groups.set(reaction.emoji, {
      emoji: reaction.emoji,
      count: 1,
      reactions: [reaction],
      includesCurrentUser:
        reaction.user_id === currentUserId,
    });
  }

  return Array.from(groups.values()).sort(
    (first, second) =>
      second.count - first.count,
  );
}

export default function MessageList({
  messages,
  currentUserId,
  isLoading,
}: MessageListProps) {
  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  const searchInputRef =
    useRef<HTMLInputElement | null>(null);

  const [isSearchOpen, setIsSearchOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    activeSearchIndex,
    setActiveSearchIndex,
  ] = useState(-1);

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const [
    openReactionPickerId,
    setOpenReactionPickerId,
  ] = useState<string | null>(null);

  const [deleteError, setDeleteError] =
    useState<string | null>(null);

  const [reactionError, setReactionError] =
    useState<string | null>(null);

  const deleteMessageMutation =
    useDeleteMessage();

  const setReactionMutation =
    useSetMessageReaction();

  const removeReactionMutation =
    useRemoveMessageReaction();

  const setReplyMessage = useReplyStore(
    (state) => state.setReplyMessage,
  );

  const visibleMessages = useMemo(
    () => messages,
    [messages],
  );

  const messagesById = useMemo(() => {
    return new Map(
      messages.map((message) => [
        message.id,
        message,
      ]),
    );
  }, [messages]);

  const normalizedSearchQuery =
    normalizeSearchValue(searchQuery);

  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    return visibleMessages.filter(
      (message) => {
        if (
          message.deleted_for_everyone_at
        ) {
          return false;
        }

        const repliedMessage =
          message.reply_to_message_id
            ? messagesById.get(
                message.reply_to_message_id,
              ) ?? null
            : null;

        const searchableText = [
          message.body ?? "",
          repliedMessage?.deleted_for_everyone_at
            ? ""
            : repliedMessage?.body ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("it-IT");

        return searchableText.includes(
          normalizedSearchQuery,
        );
      },
    );
  }, [
    messagesById,
    normalizedSearchQuery,
    visibleMessages,
  ]);

  const searchResultIds = useMemo(
    () =>
      new Set(
        searchResults.map(
          (message) => message.id,
        ),
      ),
    [searchResults],
  );

  const activeSearchMessageId =
    activeSearchIndex >= 0
      ? searchResults[activeSearchIndex]
          ?.id ?? null
      : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [visibleMessages.length]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [isSearchOpen]);

  useEffect(() => {
    if (
      !normalizedSearchQuery ||
      searchResults.length === 0
    ) {
      setActiveSearchIndex(-1);
      return;
    }

    setActiveSearchIndex(0);
  }, [
    normalizedSearchQuery,
    searchResults.length,
  ]);

  useEffect(() => {
    if (!activeSearchMessageId) {
      return;
    }

    const messageElement =
      document.getElementById(
        `message-${activeSearchMessageId}`,
      );

    messageElement?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSearchMessageId]);

  useEffect(() => {
    function handleDocumentClick() {
      setOpenMenuId(null);
      setOpenReactionPickerId(null);
    }

    function handleDocumentKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key !== "Escape") {
        return;
      }

      setOpenMenuId(null);
      setOpenReactionPickerId(null);
    }

    document.addEventListener(
      "click",
      handleDocumentClick,
    );

    document.addEventListener(
      "keydown",
      handleDocumentKeyDown,
    );

    return () => {
      document.removeEventListener(
        "click",
        handleDocumentClick,
      );

      document.removeEventListener(
        "keydown",
        handleDocumentKeyDown,
      );
    };
  }, []);

  function openSearch() {
    setIsSearchOpen(true);
  }

  function closeSearch() {
    setIsSearchOpen(false);
    setSearchQuery("");
    setActiveSearchIndex(-1);
  }

  function moveToSearchResult(
    direction: 1 | -1,
  ) {
    if (searchResults.length === 0) {
      return;
    }

    setActiveSearchIndex(
      (currentIndex) => {
        if (currentIndex < 0) {
          return direction === 1
            ? 0
            : searchResults.length - 1;
        }

        return (
          currentIndex +
          direction +
          searchResults.length
        ) % searchResults.length;
      },
    );
  }

  function handleSearchKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      moveToSearchResult(
        event.shiftKey ? -1 : 1,
      );
    }
  }

  async function handleDeleteMessage(
    message: ChatMessage,
  ) {
    const confirmed = window.confirm(
      "Vuoi eliminare questo messaggio per tutti?",
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setOpenMenuId(null);

    try {
      await deleteMessageMutation.mutateAsync({
        messageId: message.id,
        conversationId:
          message.conversation_id,
      });
    } catch (error) {
      console.error(
        "Errore durante l'eliminazione del messaggio:",
        error,
      );

      setDeleteError(
        error instanceof Error
          ? error.message
          : "Non è stato possibile eliminare il messaggio.",
      );
    }
  }

  async function handleReaction(
    message: ChatMessage,
    emoji: string,
  ) {
    const currentUserReaction =
      message.message_reactions.find(
        (reaction) =>
          reaction.user_id ===
          currentUserId,
      );

    setReactionError(null);
    setOpenReactionPickerId(null);

    try {
      if (
        currentUserReaction?.emoji === emoji
      ) {
        await removeReactionMutation.mutateAsync(
          {
            messageId: message.id,
            userId: currentUserId,
            conversationId:
              message.conversation_id,
          },
        );

        return;
      }

      await setReactionMutation.mutateAsync({
        messageId: message.id,
        userId: currentUserId,
        emoji,
        conversationId:
          message.conversation_id,
      });
    } catch (error) {
      console.error(
        "Errore durante l'aggiornamento della reazione:",
        error,
      );

      setReactionError(
        error instanceof Error
          ? error.message
          : "Non è stato possibile aggiornare la reazione.",
      );
    }
  }

  async function handleReactionGroupClick(
    message: ChatMessage,
    group: ReactionGroup,
  ) {
    if (!group.includesCurrentUser) {
      await handleReaction(
        message,
        group.emoji,
      );

      return;
    }

    setReactionError(null);

    try {
      await removeReactionMutation.mutateAsync(
        {
          messageId: message.id,
          userId: currentUserId,
          conversationId:
            message.conversation_id,
        },
      );
    } catch (error) {
      console.error(
        "Errore durante la rimozione della reazione:",
        error,
      );

      setReactionError(
        error instanceof Error
          ? error.message
          : "Non è stato possibile rimuovere la reazione.",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="message-list message-list--state">
        <div className="chat-loading">
          <span className="chat-loading__dot" />
          <span className="chat-loading__dot" />
          <span className="chat-loading__dot" />
        </div>

        <p>Caricamento messaggi...</p>
      </div>
    );
  }

  if (visibleMessages.length === 0) {
    return (
      <div className="message-list message-list--state">
        <div className="empty-chat">
          <div className="empty-chat__icon">
            💬
          </div>

          <h3>Nessun messaggio</h3>

          <p>
            Invia il primo messaggio per
            iniziare la conversazione.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      <div
        className={[
          "message-search",
          isSearchOpen
            ? "message-search--open"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {!isSearchOpen ? (
          <button
            type="button"
            className="message-search__open"
            onClick={openSearch}
            aria-label="Cerca nella conversazione"
            title="Cerca nella conversazione"
          >
            <span aria-hidden="true">
              🔍
            </span>

            <span>
              Cerca nella conversazione
            </span>
          </button>
        ) : (
          <div className="message-search__bar">
            <span
              className="message-search__icon"
              aria-hidden="true"
            >
              🔍
            </span>

            <input
              ref={searchInputRef}
              type="search"
              className="message-search__input"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              onKeyDown={handleSearchKeyDown}
              placeholder="Cerca un messaggio..."
              aria-label="Cerca un messaggio"
            />

            <span
              className="message-search__count"
              aria-live="polite"
            >
              {normalizedSearchQuery
                ? searchResults.length > 0
                  ? `${activeSearchIndex + 1}/${searchResults.length}`
                  : "0 risultati"
                : ""}
            </span>

            <button
              type="button"
              className="message-search__navigation"
              onClick={() =>
                moveToSearchResult(-1)
              }
              disabled={
                searchResults.length === 0
              }
              aria-label="Risultato precedente"
              title="Risultato precedente"
            >
              ↑
            </button>

            <button
              type="button"
              className="message-search__navigation"
              onClick={() =>
                moveToSearchResult(1)
              }
              disabled={
                searchResults.length === 0
              }
              aria-label="Risultato successivo"
              title="Risultato successivo"
            >
              ↓
            </button>

            <button
              type="button"
              className="message-search__close"
              onClick={closeSearch}
              aria-label="Chiudi ricerca"
              title="Chiudi ricerca"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {deleteError && (
        <div
          className="message-delete-error"
          role="alert"
        >
          <span>{deleteError}</span>

          <button
            type="button"
            onClick={() =>
              setDeleteError(null)
            }
            aria-label="Chiudi errore"
          >
            ×
          </button>
        </div>
      )}

      {reactionError && (
        <div
          className="message-reaction-error"
          role="alert"
        >
          <span>{reactionError}</span>

          <button
            type="button"
            onClick={() =>
              setReactionError(null)
            }
            aria-label="Chiudi errore"
          >
            ×
          </button>
        </div>
      )}

      {visibleMessages.map(
        (message, index) => {
          const previousMessage =
            index > 0
              ? visibleMessages[index - 1]
              : null;

          const nextMessage =
            index <
            visibleMessages.length - 1
              ? visibleMessages[index + 1]
              : null;

          const currentDateKey =
            getDateKey(message.created_at);

          const previousDateKey =
            previousMessage
              ? getDateKey(
                  previousMessage.created_at,
                )
              : null;

          const showDaySeparator =
            !previousMessage ||
            currentDateKey !==
              previousDateKey;

          const isOwn =
            message.sender_id ===
            currentUserId;

          const previousIsSameSender =
            previousMessage?.sender_id ===
              message.sender_id &&
            previousDateKey ===
              currentDateKey;

          const nextIsSameSender =
            nextMessage?.sender_id ===
              message.sender_id &&
            getDateKey(
              nextMessage.created_at,
            ) === currentDateKey;

          const isFirstInGroup =
            !previousIsSameSender;

          const isLastInGroup =
            !nextIsSameSender;

          const isDeleted = Boolean(
            message.deleted_for_everyone_at,
          );

          const repliedMessage =
            message.reply_to_message_id
              ? messagesById.get(
                  message.reply_to_message_id,
                ) ?? null
              : null;

          const repliedMessageIsDeleted =
            Boolean(
              repliedMessage?.deleted_for_everyone_at,
            );

          const repliedMessageLabel =
            repliedMessage?.sender_id ===
            currentUserId
              ? "Tu"
              : "Messaggio ricevuto";

          const repliedMessageHasAttachments =
            Boolean(
              repliedMessage
                ?.message_attachments.length,
            );

          const repliedMessageBody =
            repliedMessageIsDeleted
              ? "Questo messaggio è stato eliminato."
              : repliedMessage?.body?.trim() ||
                (repliedMessageHasAttachments
                  ? "📎 Allegato"
                  : "Messaggio non disponibile");

          const messageStatus =
            message.read_at
              ? "read"
              : message.delivered_at
                ? "delivered"
                : "sent";

          const messageStatusLabel =
            messageStatus === "read"
              ? "Messaggio letto"
              : messageStatus ===
                  "delivered"
                ? "Messaggio consegnato"
                : "Messaggio inviato";

          const reactionGroups =
            groupMessageReactions(
              message.message_reactions ?? [],
              currentUserId,
            );

          const currentUserReaction =
            message.message_reactions.find(
              (reaction) =>
                reaction.user_id ===
                currentUserId,
            );

          const isReactionPending =
            setReactionMutation.isPending ||
            removeReactionMutation.isPending;

          return (
            <div key={message.id}>
              {showDaySeparator && (
                <div className="message-day-separator">
                  <span>
                    {formatDayLabel(
                      message.created_at,
                    )}
                  </span>
                </div>
              )}

              <article
                id={`message-${message.id}`}
                className={[
                  "message-row",
                  searchResultIds.has(
                    message.id,
                  )
                    ? "message-row--search-result"
                    : "",
                  activeSearchMessageId ===
                  message.id
                    ? "message-row--search-active"
                    : "",
                  isOwn
                    ? "message-row--own"
                    : "",
                  isFirstInGroup
                    ? "message-row--group-start"
                    : "",
                  isLastInGroup
                    ? "message-row--group-end"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isOwn && !isDeleted && (
                  <div className="message-actions">
                    <button
                      type="button"
                      className="message-actions__trigger"
                      onClick={(event) => {
                        event.stopPropagation();

                        setOpenReactionPickerId(
                          null,
                        );

                        setOpenMenuId(
                          (currentId) =>
                            currentId ===
                            message.id
                              ? null
                              : message.id,
                        );
                      }}
                      aria-label="Apri azioni messaggio"
                      aria-expanded={
                        openMenuId === message.id
                      }
                      title="Azioni messaggio"
                    >
                      ⋮
                    </button>

                    {openMenuId ===
                      message.id && (
                      <div
                        className="message-actions__menu"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <button
                          type="button"
                          className="message-actions__delete"
                          disabled={
                            deleteMessageMutation.isPending
                          }
                          onClick={() =>
                            void handleDeleteMessage(
                              message,
                            )
                          }
                        >
                          {deleteMessageMutation.isPending
                            ? "Eliminazione..."
                            : "Elimina per tutti"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!isDeleted && (
                  <div className="message-reaction-action">
                    <button
                      type="button"
                      className={[
                        "message-reaction-action__trigger",
                        currentUserReaction
                          ? "message-reaction-action__trigger--active"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={(event) => {
                        event.stopPropagation();

                        setOpenMenuId(null);

                        setOpenReactionPickerId(
                          (currentId) =>
                            currentId ===
                            message.id
                              ? null
                              : message.id,
                        );
                      }}
                      aria-label="Aggiungi una reazione"
                      aria-expanded={
                        openReactionPickerId ===
                        message.id
                      }
                      title="Aggiungi una reazione"
                    >
                      {currentUserReaction?.emoji ??
                        "☺"}
                    </button>

                    {openReactionPickerId ===
                      message.id && (
                      <div
                        className="message-reaction-picker"
                        role="menu"
                        aria-label="Scegli una reazione"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        {REACTION_OPTIONS.map(
                          (emoji) => {
                            const isSelected =
                              currentUserReaction
                                ?.emoji ===
                              emoji;

                            return (
                              <button
                                key={emoji}
                                type="button"
                                className={[
                                  "message-reaction-picker__option",
                                  isSelected
                                    ? "message-reaction-picker__option--selected"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                disabled={
                                  isReactionPending
                                }
                                onClick={() =>
                                  void handleReaction(
                                    message,
                                    emoji,
                                  )
                                }
                                role="menuitem"
                                aria-label={
                                  isSelected
                                    ? `Rimuovi reazione ${emoji}`
                                    : `Reagisci con ${emoji}`
                                }
                                title={
                                  isSelected
                                    ? "Rimuovi reazione"
                                    : "Aggiungi reazione"
                                }
                              >
                                {emoji}
                              </button>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!isDeleted && (
                  <button
                    type="button"
                    className="message-reply-button"
                    onClick={() => {
                      setReplyMessage({
                        id: message.id,
                        conversationId:
                          message.conversation_id,
                        senderId:
                          message.sender_id,
                        body:
                          message.body ?? "",
                      });
                    }}
                    aria-label="Rispondi al messaggio"
                    title="Rispondi"
                  >
                    ↩
                  </button>
                )}

                <div className="message-content">
                  <div
                    className={[
                      "message-bubble",
                      isDeleted
                        ? "message-bubble--deleted"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {message.reply_to_message_id && (
                      <div className="message-bubble__reply">
                        <span className="message-bubble__reply-label">
                          {repliedMessage
                            ? repliedMessageLabel
                            : "Messaggio"}
                        </span>

                        <p className="message-bubble__reply-text">
                          {highlightSearchText(
                            repliedMessageBody,
                            searchQuery,
                          )}
                        </p>
                      </div>
                    )}

                    {isDeleted ? (
                      <p className="message-bubble__body">
                        Questo messaggio è stato
                        eliminato.
                      </p>
                    ) : (
                      <>
                        {message
                          .message_attachments
                          .length > 0 && (
                          <div className="message-bubble__attachments">
                            {message.message_attachments.map(
                              (
                                attachment,
                              ) => (
                                <MessageAttachment
                                  key={
                                    attachment.id
                                  }
                                  attachment={
                                    attachment
                                  }
                                />
                              ),
                            )}
                          </div>
                        )}

                        {message.body?.trim() && (
                          <p className="message-bubble__body">
                            {highlightSearchText(
                              message.body,
                              searchQuery,
                            )}
                          </p>
                        )}
                      </>
                    )}

                    <div className="message-bubble__footer">
                      <time
                        dateTime={
                          message.created_at
                        }
                      >
                        {formatMessageTime(
                          message.created_at,
                        )}
                      </time>

                      {isOwn && !isDeleted && (
                        <span
                          className={[
                            "message-status",
                            messageStatus ===
                            "read"
                              ? "message-status--read"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={
                            messageStatusLabel
                          }
                          aria-label={
                            messageStatusLabel
                          }
                        >
                          {messageStatus ===
                          "sent"
                            ? "✓"
                            : "✓✓"}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isDeleted &&
                    reactionGroups.length >
                      0 && (
                      <div className="message-reactions">
                        {reactionGroups.map(
                          (group) => (
                            <button
                              key={group.emoji}
                              type="button"
                              className={[
                                "message-reactions__item",
                                group.includesCurrentUser
                                  ? "message-reactions__item--active"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              disabled={
                                isReactionPending
                              }
                              onClick={() =>
                                void handleReactionGroupClick(
                                  message,
                                  group,
                                )
                              }
                              aria-label={
                                group.includesCurrentUser
                                  ? `Rimuovi la tua reazione ${group.emoji}`
                                  : `Aggiungi la reazione ${group.emoji}`
                              }
                              title={
                                group.includesCurrentUser
                                  ? "Clicca per rimuovere la tua reazione"
                                  : "Clicca per aggiungere questa reazione"
                              }
                            >
                              <span
                                className="message-reactions__emoji"
                                aria-hidden="true"
                              >
                                {group.emoji}
                              </span>

                              <span className="message-reactions__count">
                                {group.count}
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                    )}
                </div>
              </article>
            </div>
          );
        },
      )}

      <div
        ref={bottomRef}
        className="message-list__bottom"
      />
    </div>
  );
}