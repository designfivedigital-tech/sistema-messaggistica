import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { markConversationMessagesRead } from "./messageService";
import { messagesQueryKey } from "./useMessages";

export function useMarkMessagesRead(
  conversationId: string | null,
  enabled = true,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId || !enabled) {
      return;
    }

    const activeConversationId = conversationId;
    let cancelled = false;

    async function markAsRead() {
      try {
        await markConversationMessagesRead(
          activeConversationId,
        );

        if (cancelled) {
          return;
        }

        await queryClient.invalidateQueries({
          queryKey: messagesQueryKey(
            activeConversationId,
          ),
        });

        await queryClient.invalidateQueries({
          queryKey: ["company-conversations"],
        });
      } catch (error) {
        console.error(
          "Errore aggiornamento lettura messaggi:",
          error,
        );
      }
    }

    function handleWindowFocus() {
      void markAsRead();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void markAsRead();
      }
    }

    void markAsRead();

    window.addEventListener(
      "focus",
      handleWindowFocus,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "focus",
        handleWindowFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [conversationId, enabled, queryClient]);
}