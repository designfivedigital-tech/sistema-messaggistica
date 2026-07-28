import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { messagesQueryKey } from "./useMessages";
import { removeMessageReaction } from "./reactionService";

import type { ChatMessage } from "./types";

export function useRemoveMessageReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeMessageReaction,

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

            return {
              ...message,
              message_reactions:
                message.message_reactions.filter(
                  (reaction) =>
                    reaction.user_id !==
                    variables.userId,
                ),
            };
          });
        },
      );

      return {
        previousMessages,
        queryKey,
      };
    },

    onError: (
      error,
      _variables,
      context,
    ) => {
      console.error(
        "Errore rimozione reazione:",
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