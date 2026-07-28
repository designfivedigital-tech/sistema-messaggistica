import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { messagesQueryKey } from "./useMessages";
import { setMessageReaction } from "./reactionService";

import type {
  ChatMessage,
  ChatReaction,
} from "./types";

export function useSetMessageReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setMessageReaction,

    onMutate: async (variables) => {
      const queryKey = messagesQueryKey(
        variables.conversationId,
      );

      await queryClient.cancelQueries({
        queryKey,
      });

      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(
          queryKey,
        );

      const temporaryReaction: ChatReaction = {
        id: `temporary-${variables.messageId}-${variables.userId}`,
        message_id: variables.messageId,
        user_id: variables.userId,
        emoji: variables.emoji,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<ChatMessage[]>(
        queryKey,
        (currentMessages) => {
          if (!currentMessages) {
            return currentMessages;
          }

          return currentMessages.map((message) => {
            if (
              message.id !== variables.messageId
            ) {
              return message;
            }

            const reactionsWithoutCurrentUser =
              message.message_reactions.filter(
                (reaction) =>
                  reaction.user_id !==
                  variables.userId,
              );

            return {
              ...message,
              message_reactions: [
                ...reactionsWithoutCurrentUser,
                temporaryReaction,
              ],
            };
          });
        },
      );

      return {
        previousMessages,
        queryKey,
      };
    },

    onSuccess: (
      savedReaction,
      variables,
    ) => {
      const queryKey = messagesQueryKey(
        variables.conversationId,
      );

      queryClient.setQueryData<ChatMessage[]>(
        queryKey,
        (currentMessages) => {
          if (!currentMessages) {
            return currentMessages;
          }

          return currentMessages.map((message) => {
            if (
              message.id !== savedReaction.message_id
            ) {
              return message;
            }

            const remainingReactions =
              message.message_reactions.filter(
                (reaction) =>
                  reaction.user_id !==
                    savedReaction.user_id &&
                  reaction.id !==
                    savedReaction.id,
              );

            return {
              ...message,
              message_reactions: [
                ...remainingReactions,
                savedReaction,
              ],
            };
          });
        },
      );
    },

    onError: (
      error,
      _variables,
      context,
    ) => {
      console.error(
        "Errore aggiunta reazione:",
        error,
      );

      if (
        context?.previousMessages &&
        context.queryKey
      ) {
        queryClient.setQueryData(
          context.queryKey,
          context.previousMessages,
        );
      }
    },
  });
}