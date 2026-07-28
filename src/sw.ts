/// <reference lib="webworker" />

import {
  cleanupOutdatedCaches,
  precacheAndRoute,
} from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string;
    revision: string | null;
  }>;
};

type PushNotificationData = {
  url?: string;
  recipientUserId?: string;
  conversationId?: string | null;
  messageId?: string | null;
};

type PushNotificationPayload = {
  type?: string;
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  timestamp?: number;
  unreadCount?: number;
  data?: PushNotificationData;

  /*
   * Compatibilità con eventuali payload
   * precedenti che avevano questi valori
   * al livello principale.
   */
  url?: string;
  conversationId?: string | null;
  messageId?: string | null;
};

type ServiceWorkerMessage = {
  type?: string;
  count?: number;
};

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener(
  "activate",
  (event: ExtendableEvent) => {
    event.waitUntil(self.clients.claim());
  },
);

self.addEventListener(
  "push",
  (event: PushEvent) => {
    const payload =
      readPushPayload(event);

    const notificationData:
      PushNotificationData = {
        url:
          payload.data?.url ??
          payload.url ??
          "/",

        recipientUserId:
          payload.data?.recipientUserId,

        conversationId:
          payload.data?.conversationId ??
          payload.conversationId ??
          null,

        messageId:
          payload.data?.messageId ??
          payload.messageId ??
          null,
      };

    const notificationOptions:
      NotificationOptions & {
        renotify?: boolean;
      } = {
        body:
          payload.body ??
          "Hai ricevuto un nuovo messaggio.",

        icon:
          payload.icon ??
          "/pwa-192x192.png",

        badge:
          payload.badge ??
          "/pwa-192x192.png",

        tag:
          payload.tag ??
          (
            notificationData.conversationId
              ? `conversation-${notificationData.conversationId}`
              : "new-message"
          ),

        renotify:
          payload.renotify ?? true,

        requireInteraction:
          payload.requireInteraction ?? false,


        data: notificationData,
      };

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(
          payload.title ??
            "Nuovo messaggio",
          notificationOptions,
        ),

        setApplicationBadge(
          payload.unreadCount,
        ),
      ]),
    );
  },
);

self.addEventListener(
  "notificationclick",
  (event: NotificationEvent) => {
    event.notification.close();

    const notificationData =
      event.notification.data as
        | PushNotificationData
        | undefined;

    const destinationUrl =
      normalizeInternalUrl(
        notificationData?.url,
      );

    event.waitUntil(
      openOrFocusApplication(
        destinationUrl,
      ),
    );
  },
);

self.addEventListener(
  "message",
  (
    event: ExtendableMessageEvent,
  ) => {
    const data =
      event.data as
        | ServiceWorkerMessage
        | undefined;

    if (!data?.type) {
      return;
    }

    if (
      data.type === "SET_APP_BADGE"
    ) {
      event.waitUntil(
        setApplicationBadge(
          data.count,
        ),
      );

      return;
    }

    if (
      data.type === "CLEAR_APP_BADGE"
    ) {
      event.waitUntil(
        clearApplicationBadge(),
      );
    }
  },
);

function readPushPayload(
  event: PushEvent,
): PushNotificationPayload {
  const fallbackPayload:
    PushNotificationPayload = {
      type: "message",
      title: "Nuovo messaggio",
      body:
        "Hai ricevuto un nuovo messaggio.",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: "new-message",
      renotify: true,
      requireInteraction: false,
      timestamp: Date.now(),
      data: {
        url: "/",
        conversationId: null,
        messageId: null,
      },
    };

  if (!event.data) {
    return fallbackPayload;
  }

  try {
    const receivedPayload =
      event.data.json() as
        PushNotificationPayload;

    return {
      ...fallbackPayload,
      ...receivedPayload,

      data: {
        ...fallbackPayload.data,
        ...receivedPayload.data,
      },
    };
  } catch (error) {
    console.warn(
      "Payload push non JSON:",
      error,
    );

    return {
      ...fallbackPayload,
      body:
        event.data.text() ||
        fallbackPayload.body,
    };
  }
}

function normalizeInternalUrl(
  value?: string,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}

async function openOrFocusApplication(
  destinationUrl: string,
): Promise<void> {
  const normalizedUrl =
    normalizeInternalUrl(
      destinationUrl,
    );

  const absoluteUrl = new URL(
    normalizedUrl,
    self.location.origin,
  ).href;

  const clientList =
    await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

  for (const client of clientList) {
    const windowClient =
      client as WindowClient;

    try {
      /*
       * Comunichiamo la destinazione anche
       * all'app già aperta. Il frontend può
       * intercettare OPEN_NOTIFICATION_URL
       * e navigare tramite React Router.
       */
      windowClient.postMessage({
        type:
          "OPEN_NOTIFICATION_URL",
        url: absoluteUrl,
      });

      if (
        "navigate" in windowClient &&
        windowClient.url !== absoluteUrl
      ) {
        await windowClient.navigate(
          absoluteUrl,
        );
      }

      await windowClient.focus();

      return;
    } catch (error) {
      console.warn(
        "Impossibile riutilizzare la finestra aperta:",
        error,
      );
    }
  }

  await self.clients.openWindow(
    absoluteUrl,
  );
}

async function setApplicationBadge(
  count?: number,
): Promise<void> {
  if (
    !("setAppBadge" in self.navigator)
  ) {
    return;
  }

  try {
    const navigatorWithBadge =
      self.navigator as Navigator & {
        setAppBadge: (
          contents?: number,
        ) => Promise<void>;
      };

    if (
      typeof count === "number" &&
      Number.isFinite(count) &&
      count > 0
    ) {
      await navigatorWithBadge.setAppBadge(
        Math.floor(count),
      );

      return;
    }

    await navigatorWithBadge.setAppBadge();
  } catch (error) {
    console.warn(
      "Impossibile impostare il badge PWA:",
      error,
    );
  }
}

async function clearApplicationBadge():
  Promise<void> {
  if (
    !("clearAppBadge" in self.navigator)
  ) {
    return;
  }

  try {
    const navigatorWithBadge =
      self.navigator as Navigator & {
        clearAppBadge:
          () => Promise<void>;
      };

    await navigatorWithBadge.clearAppBadge();
  } catch (error) {
    console.warn(
      "Impossibile rimuovere il badge PWA:",
      error,
    );
  }
}