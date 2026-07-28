import { supabase } from "../../lib/supabase";

type TestPushResult = {
  success: boolean;
  requestId?: string;
  subscriptionsFound?: number;
  sent?: number;
  failed?: number;
  removed?: number;
  error?: string;
};

export async function sendTestPushNotification(): Promise<TestPushResult> {
  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const session = sessionData.session;

  if (!session) {
    throw new Error(
      "Sessione non disponibile. Esci dall'app ed effettua nuovamente l'accesso.",
    );
  }

  const userId = session.user.id;
  const accessToken = session.access_token;

  const { data, error } =
    await supabase.functions.invoke<TestPushResult>(
      "notify-message",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },

        body: {
          recipientUserId: userId,
          title: "Sistema Messaggistica",
          body: "La notifica push funziona correttamente.",
          url: "/",
          tag: `push-test-${Date.now()}`,
        },
      },
    );

  console.log("Risposta notify-message:", {
    data,
    error,
    userId,
    hasAccessToken: Boolean(accessToken),
  });

  if (error) {
    let errorMessage = error.message;

    /*
     * FunctionsHttpError contiene spesso la risposta HTTP
     * nel campo context.
     */
    if (
      "context" in error &&
      error.context instanceof Response
    ) {
      try {
        const responseBody =
          await error.context.clone().text();

        if (responseBody) {
          errorMessage = `${errorMessage}: ${responseBody}`;
        }
      } catch {
        // Manteniamo il messaggio originale.
      }
    }

    throw new Error(errorMessage);
  }

  if (!data) {
    throw new Error(
      "La funzione non ha restituito una risposta.",
    );
  }

  if (!data.success) {
    throw new Error(
      data.error ??
        `Notifica non inviata. Inviate: ${
          data.sent ?? 0
        }, errori: ${data.failed ?? 0}`,
    );
  }

  return data;
}