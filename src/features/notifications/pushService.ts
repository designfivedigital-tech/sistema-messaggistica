import { supabase } from "../../lib/supabase";

const vapidPublicKey =
  import.meta.env.VITE_VAPID_PUBLIC_KEY;

type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushRegistrationResult =
  | {
      status: "subscribed";
      subscription: PushSubscription;
    }
  | {
      status: "already-subscribed";
      subscription: PushSubscription;
    }
  | {
      status: "permission-denied";
    }
  | {
      status: "unsupported";
    };

function assertPushConfiguration(): void {
  if (!vapidPublicKey) {
    throw new Error(
      "VITE_VAPID_PUBLIC_KEY non configurata.",
    );
  }
}

function urlBase64ToUint8Array(
  base64String: string,
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4,
  );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) =>
      character.charCodeAt(0),
    ),
  );
}

function getSubscriptionKeys(
  subscription: PushSubscription,
): PushSubscriptionRecord {
  const subscriptionJson =
    subscription.toJSON();

  const p256dh =
    subscriptionJson.keys?.p256dh;

  const auth =
    subscriptionJson.keys?.auth;

  if (!p256dh || !auth) {
    throw new Error(
      "La sottoscrizione push non contiene le chiavi richieste.",
    );
  }

  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
  };
}

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      "Utente non autenticato.",
    );
  }

  return user.id;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Service Worker non supportati.",
    );
  }

  return navigator.serviceWorker.ready;
}

async function savePushSubscription(
  subscription: PushSubscription,
): Promise<void> {
  const userId =
    await getAuthenticatedUserId();

  const {
    endpoint,
    p256dh,
    auth,
  } = getSubscriptionKeys(subscription);

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict: "user_id,endpoint",
      },
    );

  if (error) {
    throw error;
  }
}

export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }

  return Notification.permission;
}

export async function registerPushNotifications(): Promise<PushRegistrationResult> {
  if (!isPushSupported()) {
    return {
      status: "unsupported",
    };
  }

  assertPushConfiguration();

  let permission =
    Notification.permission;

  if (permission === "default") {
    permission =
      await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      status: "permission-denied",
    };
  }

  const registration =
    await getServiceWorkerRegistration();

  const existingSubscription =
    await registration.pushManager.getSubscription();

  if (existingSubscription) {
    await savePushSubscription(
      existingSubscription,
    );

    return {
      status: "already-subscribed",
      subscription:
        existingSubscription,
    };
  }

  const applicationServerKey =
    urlBase64ToUint8Array(
      vapidPublicKey,
    );

  const subscription =
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

  await savePushSubscription(subscription);

  return {
    status: "subscribed",
    subscription,
  };
}

export async function refreshPushSubscription(): Promise<void> {
  if (!isPushSupported()) {
    return;
  }

  if (
    Notification.permission !== "granted"
  ) {
    return;
  }

  const registration =
    await getServiceWorkerRegistration();

  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  await savePushSubscription(subscription);
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    return;
  }

  const registration =
    await getServiceWorkerRegistration();

  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  const endpoint =
    subscription.endpoint;

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    throw error;
  }

  await subscription.unsubscribe();
}