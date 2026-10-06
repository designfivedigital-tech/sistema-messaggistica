import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabase";

/*
 * Tiene aggiornata la lista delle conversazioni
 * dell'azienda anche per le chat non aperte:
 * nuovi messaggi, letture e cambi di stato.
 */
export function useCompanyConversationsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function refreshConversations() {
      void queryClient.invalidateQueries({
        queryKey: ["company-conversations"],
      });
    }

    const channel = supabase
      .channel("company-conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        refreshConversations,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        refreshConversations,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
