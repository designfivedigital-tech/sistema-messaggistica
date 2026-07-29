import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { deleteConversationComplete } from "./conversationService";

type DeleteConversationVariables = {
  conversationId: string;
};

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
    }: DeleteConversationVariables) =>
      deleteConversationComplete(conversationId),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["company-conversations"],
      });
    },
  });
}