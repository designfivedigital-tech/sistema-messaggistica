import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { sendMessage } from "./messageService";
import { messagesQueryKey } from "./useMessages";

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessage,

    onSuccess: async (message) => {
      await queryClient.invalidateQueries({
        queryKey: messagesQueryKey(
          message.conversation_id,
        ),
      });

      await queryClient.invalidateQueries({
        queryKey: ["company-conversations"],
      });
    },
  });
}