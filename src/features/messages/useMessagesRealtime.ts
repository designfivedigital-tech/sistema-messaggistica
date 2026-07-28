import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabase";
import { markConversationMessagesRead } from "./messageService";
import { messagesQueryKey } from "./useMessages";

import type {
  ChatMessage,
  ChatReaction,
} from "./types";

export function useMessagesRealtime(
  conversationId: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const queryKey =
      messagesQueryKey(conversationId);

    const refreshMessages = async () => {
      await queryClient.invalidateQueries({
        queryKey,
      });

      await queryClient.invalidateQueries({
        queryKey: ["company-conversations"],
      });
    };

    function insertOrUpdateReaction(
      reaction: ChatReaction,
    ) {
      queryClient.setQueryData<ChatMessage[]>(
        queryKey,
        (currentMessages) => {
          if (!currentMessages) {
            return currentMessages;
          }

          return currentMessages.map((message) => {
            if (
              message.id !== reaction.message_id
            ) {
              return message;
            }

            const currentReactions =
              message.message_reactions ?? [];

            /*
             * Ogni utente può avere una sola
             * reazione per messaggio.
             *
             * Sostituiamo quindi:
             * - la reazione con lo stesso ID;
             * - l'eventuale reazione dello stesso utente.
             */
            const remainingReactions =
              currentReactions.filter(
                (currentReaction) =>
                  currentReaction.id !==
                    reaction.id &&
                  currentReaction.user_id !==
                    reaction.user_id,
              );

            return {
              ...message,
              message_reactions: [
                ...remainingReactions,
                reaction,
              ],
            };
          });
        },
      );
    }

    function deleteReaction(
      reactionId: string,
    ) {
      queryClient.setQueryData<ChatMessage[]>(
        queryKey,
        (currentMessages) => {
          if (!currentMessages) {
            return currentMessages;
          }

          return currentMessages.map((message) => ({
            ...message,
            message_reactions:
              message.message_reactions.filter(
                (reaction) =>
                  reaction.id !== reactionId,
              ),
          }));
        },
      );
    }

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          await refreshMessages();

          if (
            payload.eventType === "INSERT" &&
            document.visibilityState ===
              "visible"
          ) {
            try {
              await markConversationMessagesRead(
                conversationId,
              );

              await refreshMessages();
            } catch (error) {
              console.error(
                "Errore aggiornamento lettura realtime:",
                error,
              );
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          insertOrUpdateReaction(
            payload.new as ChatReaction,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          insertOrUpdateReaction(
            payload.new as ChatReaction,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const deletedReaction =
            payload.old as Partial<ChatReaction>;

          if (!deletedReaction.id) {
            return;
          }

          deleteReaction(deletedReaction.id);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error(
            "Errore nel canale realtime della conversazione.",
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}