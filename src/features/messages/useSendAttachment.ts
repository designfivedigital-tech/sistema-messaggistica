import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { sendMessageWithAttachment } from "./attachmentService";
import { messagesQueryKey } from "./useMessages";

export function useSendAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessageWithAttachment,

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