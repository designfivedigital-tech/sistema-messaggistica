import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { updateConversationStatus } from "./conversationService";
import type {
  ConversationStatus,
} from "./types";

type UpdateConversationStatusVariables = {
  conversationId: string;
  status: ConversationStatus;
};

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      status,
    }: UpdateConversationStatusVariables) =>
      updateConversationStatus(
        conversationId,
        status,
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["company-conversations"],
      });
    },
  });
}