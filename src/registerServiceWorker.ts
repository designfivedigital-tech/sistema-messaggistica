import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    console.warn(
      "Il browser non supporta i Service Worker.",
    );

    return;
  }

  registerSW({
    immediate: true,

    onRegisteredSW(
      serviceWorkerUrl,
      registration,
    ) {
      console.info(
        "Service Worker registrato:",
        serviceWorkerUrl,
      );

      if (!registration) {
        return;
      }

      window.setInterval(
        () => {
          void registration.update();
        },
        60 * 60 * 1000,
      );
    },

    onRegisterError(error) {
      console.error(
        "Errore durante la registrazione del Service Worker:",
        error,
      );
    },
  });
}