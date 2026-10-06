import { useState } from "react";

import {
  useEnablePushNotifications,
  usePushNotificationStatus,
} from "./usePushNotifications";

export function PushNotificationButton() {
  const [message, setMessage] =
    useState<string | null>(null);

  const statusQuery =
    usePushNotificationStatus();

  const enablePushMutation =
    useEnablePushNotifications();

  const isSupported =
    statusQuery.data?.supported ?? false;

  const permission =
    statusQuery.data?.permission ?? "default";

  const isActive =
    permission === "granted" &&
    (statusQuery.data?.subscribed ?? false);

  async function handleEnablePush() {
    setMessage(null);

    try {
      const result =
        await enablePushMutation.mutateAsync();

      switch (result.status) {
        case "subscribed":
          setMessage(
            "Notifiche attivate correttamente.",
          );
          break;

        case "already-subscribed":
          setMessage(
            "Le notifiche sono già attive su questo dispositivo.",
          );
          break;

        case "permission-denied":
          setMessage(
            "Permesso notifiche negato. Riattivalo dalle impostazioni del browser.",
          );
          break;

        case "unsupported":
          setMessage(
            "Questo browser non supporta le notifiche push.",
          );
          break;
      }

      await statusQuery.refetch();
    } catch (error) {
      console.error(
        "Errore attivazione notifiche:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Impossibile attivare le notifiche.",
      );
    }
  }

  if (statusQuery.isLoading) {
    return null;
  }

  if (!isSupported) {
    return (
      <div className="push-notification-card">
        <strong>
          Notifiche non supportate
        </strong>

        <p>
          Questo browser non supporta le
          notifiche push.
        </p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="push-notification-card push-notification-card--warning">
        <strong>
          Notifiche bloccate
        </strong>

        <p>
          Abilita le notifiche dalle
          impostazioni del browser.
        </p>
      </div>
    );
  }

  const isBusy = enablePushMutation.isPending;

  return (
    <div className="push-notification-card">
      <div className="push-notification-card__content">
        <strong>
          Notifiche messaggi
        </strong>

        <p>
          Ricevi una notifica quando arriva
          un nuovo messaggio.
        </p>
      </div>

      <div className="push-notification-card__actions">
        <button
          type="button"
          className={
            isActive
              ? "push-notification-card__button push-notification-card__button--active"
              : "push-notification-card__button"
          }
          disabled={isBusy}
          aria-pressed={isActive}
          title={
            isActive
              ? "Le notifiche sono attive su questo dispositivo"
              : "Attiva le notifiche su questo dispositivo"
          }
          onClick={handleEnablePush}
        >
          {enablePushMutation.isPending
            ? "Attivazione..."
            : isActive
              ? "Notifiche attive ✓"
              : "Attiva notifiche"}
        </button>
      </div>

      {message ? (
        <p className="push-notification-card__message">
          {message}
        </p>
      ) : null}
    </div>
  );
}