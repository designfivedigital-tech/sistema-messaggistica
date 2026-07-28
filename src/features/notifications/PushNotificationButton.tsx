import { useState } from "react";

import { sendTestPushNotification } from "./testPushNotification";
import {
  useEnablePushNotifications,
  usePushNotificationStatus,
} from "./usePushNotifications";

export function PushNotificationButton() {
  const [message, setMessage] =
    useState<string | null>(null);

  const [isTesting, setIsTesting] =
    useState(false);

  const statusQuery =
    usePushNotificationStatus();

  const enablePushMutation =
    useEnablePushNotifications();

  const isSupported =
    statusQuery.data?.supported ?? false;

  const permission =
    statusQuery.data?.permission ?? "default";

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

  async function handleTestPush() {
    setMessage(null);
    setIsTesting(true);

    try {
      const result =
        await sendTestPushNotification();

      console.log(
        "Test push completato:",
        result,
      );

      setMessage(
        `Notifica inviata correttamente. Dispositivi raggiunti: ${
          result.sent ?? 0
        }.`,
      );
    } catch (error) {
      console.error(
        "Test push fallito:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Impossibile inviare la notifica di prova.",
      );
    } finally {
      setIsTesting(false);
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

  const isBusy =
    enablePushMutation.isPending ||
    isTesting;

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
          className="push-notification-card__button"
          disabled={isBusy}
          onClick={handleEnablePush}
        >
          {enablePushMutation.isPending
            ? "Attivazione..."
            : permission === "granted"
              ? "Verifica registrazione"
              : "Attiva notifiche"}
        </button>

        {permission === "granted" ? (
          <button
            type="button"
            className="push-notification-card__button push-notification-card__button--test"
            disabled={isBusy}
            onClick={handleTestPush}
          >
            {isTesting
              ? "Invio..."
              : "Invia notifica di prova"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="push-notification-card__message">
          {message}
        </p>
      ) : null}
    </div>
  );
}