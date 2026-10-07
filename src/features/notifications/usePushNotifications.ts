import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import {
  ensurePushSubscription,
  getNotificationPermission,
  isPushSupported,
  registerPushNotifications,
  unregisterPushNotifications,
} from "./pushService";

export const pushNotificationKeys = {
  all: ["push-notifications"] as const,
  status: () =>
    [...pushNotificationKeys.all, "status"] as const,
};

export function usePushNotificationStatus() {
  return useQuery({
    queryKey:
      pushNotificationKeys.status(),

    queryFn: async () => {
      let subscribed = false;

      try {
        subscribed =
          await ensurePushSubscription();
      } catch (error) {
        console.error(
          "Impossibile ripristinare la sottoscrizione push:",
          error,
        );
      }

      return {
        supported: isPushSupported(),
        permission:
          getNotificationPermission(),
        subscribed,
      };
    },

    /*
     * Ricontrolla quando l'utente torna nell'app,
     * così un controllo fallito non lascia lo stato
     * sbagliato per tutta la sessione.
     */
    staleTime: 60_000,
  });
}

export function useEnablePushNotifications() {
  return useMutation({
    mutationFn:
      registerPushNotifications,
  });
}

export function useDisablePushNotifications() {
  return useMutation({
    mutationFn:
      unregisterPushNotifications,
  });
}