import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { deleteMessageForEveryone } from "./deleteMessageService";
import { messagesQueryKey } from "./useMessages";

type DeleteMessageInput = {
  messageId: string;
  conversationId: string;
};

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      messageId,
    }: DeleteMessageInput) =>
      deleteMessageForEveryone(messageId),

    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: messagesQueryKey(
          variables.conversationId,
        ),
      });

      await queryClient.invalidateQueries({
        queryKey: ["company-conversations"],
      });
    },
  });
}