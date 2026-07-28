import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import {
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

    queryFn: async () => ({
      supported: isPushSupported(),
      permission:
        getNotificationPermission(),
    }),

    staleTime: Infinity,
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