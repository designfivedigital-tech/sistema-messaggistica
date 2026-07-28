import { useQuery } from "@tanstack/react-query";
import { getConversationMessages } from "./messageService";

export function messagesQueryKey(
  conversationId: string,
) {
  return ["messages", conversationId] as const;
}

export function useMessages(
  conversationId: string | null,
) {
  return useQuery({
    queryKey: messagesQueryKey(
      conversationId ?? "none",
    ),
    queryFn: () =>
      getConversationMessages(conversationId as string),
    enabled: Boolean(conversationId),
    staleTime: 10_000,
    retry: 1,
  });
}