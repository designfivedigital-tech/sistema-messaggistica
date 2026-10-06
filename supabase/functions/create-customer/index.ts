import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/*
 * Registrazione di un cliente da parte
 * dell'azienda. La registrazione pubblica è
 * disattivata: gli account cliente nascono
 * solo da qui.
 */

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 120;

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function readString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeWebsiteUrl(
  value: string,
): string | null {
  if (!value) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(value)
    ? value
    : `https://${value}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    throw new HttpError(
      400,
      "Il sito web non è un indirizzo valido",
    );
  }
}

export default {
  fetch: withSupabase(
    {
      auth: ["user"],
    },

    async (req, ctx) => {
      if (req.method !== "POST") {
        return jsonResponse(
          { error: "Method not allowed" },
          405,
        );
      }

      try {
        const callerUserId =
          typeof ctx.userClaims?.id === "string"
            ? ctx.userClaims.id
            : typeof ctx.jwtClaims?.sub ===
                "string"
              ? ctx.jwtClaims.sub
              : null;

        if (!callerUserId) {
          throw new HttpError(
            401,
            "Utente autenticato non riconosciuto",
          );
        }

        const admin = ctx.supabaseAdmin;

        const { data: callerProfile } = await admin
          .from("profiles")
          .select("role")
          .eq("id", callerUserId)
          .maybeSingle();

        if (callerProfile?.role !== "company") {
          throw new HttpError(
            403,
            "Solo l'azienda può registrare un cliente",
          );
        }

        let input: Record<string, unknown>;

        try {
          input = (await req.json()) as Record<
            string,
            unknown
          >;
        } catch {
          throw new HttpError(
            400,
            "Il corpo della richiesta non è JSON valido",
          );
        }

        /*
         * Reimpostazione della password di un
         * cliente già registrato.
         */
        if (
          readString(input?.action) ===
          "reset-password"
        ) {
          const targetCustomerId = readString(
            input?.customerId,
          );

          const newPassword =
            typeof input?.password === "string"
              ? input.password
              : "";

          if (!targetCustomerId) {
            throw new HttpError(
              400,
              "customerId è obbligatorio",
            );
          }

          if (
            newPassword.length < MIN_PASSWORD_LENGTH
          ) {
            throw new HttpError(
              400,
              `La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri`,
            );
          }

          const { data: targetProfile } = await admin
            .from("profiles")
            .select("role")
            .eq("id", targetCustomerId)
            .maybeSingle();

          /*
           * Da qui si può cambiare solo la password
           * dei clienti, mai quella dell'azienda.
           */
          if (targetProfile?.role !== "customer") {
            throw new HttpError(
              404,
              "Cliente non trovato",
            );
          }

          const { data: updated, error: updateError } =
            await admin.auth.admin.updateUserById(
              targetCustomerId,
              { password: newPassword },
            );

          if (updateError || !updated?.user) {
            console.error("Password reset failed", {
              message: updateError?.message,
            });

            throw new HttpError(
              500,
              "Impossibile reimpostare la password",
            );
          }

          return jsonResponse({
            customerId: targetCustomerId,
            email: updated.user.email ?? "",
            warnings: [],
          });
        }

        const displayName = readString(
          input?.displayName,
        ).slice(0, MAX_NAME_LENGTH);

        const email = readString(
          input?.email,
        ).toLowerCase();

        const password =
          typeof input?.password === "string"
            ? input.password
            : "";

        const websiteUrl = normalizeWebsiteUrl(
          readString(input?.websiteUrl),
        );

        const category = readString(
          input?.category,
        );

        if (!displayName) {
          throw new HttpError(
            400,
            "Inserisci il nome del cliente",
          );
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new HttpError(
            400,
            "Inserisci un'email valida",
          );
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
          throw new HttpError(
            400,
            `La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri`,
          );
        }

        const { data: created, error: createError } =
          await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              display_name: displayName,
            },
          });

        if (createError || !created?.user) {
          console.error("Customer creation failed", {
            message: createError?.message,
          });

          const alreadyExists =
            /already|registered|exists/i.test(
              createError?.message ?? "",
            );

          throw new HttpError(
            alreadyExists ? 409 : 500,
            alreadyExists
              ? "Esiste già un account con questa email"
              : "Impossibile creare l'account del cliente",
          );
        }

        const customerId = created.user.id;

        /*
         * Il profilo viene creato dal database alla
         * nascita dell'utente: qui si completano i
         * dati. Gli errori successivi non annullano
         * l'account, ma vengono segnalati.
         */
        const warnings: string[] = [];

        const { error: profileError } = await admin
          .from("profiles")
          .update({
            display_name: displayName,
            website_url: websiteUrl,
          })
          .eq("id", customerId);

        if (profileError) {
          console.error("Profile update failed", {
            message: profileError.message,
          });

          warnings.push(
            "profilo non completato (nome o sito web)",
          );
        }

        const { data: existingConversation } =
          await admin
            .from("conversations")
            .select("id")
            .eq("customer_id", customerId)
            .maybeSingle();

        if (!existingConversation) {
          const { error: conversationError } =
            await admin
              .from("conversations")
              .insert({
                customer_id: customerId,
                status: "new",
              });

          if (conversationError) {
            console.error(
              "Conversation creation failed",
              {
                message: conversationError.message,
              },
            );

            warnings.push(
              "conversazione non creata: il cliente comparirà dopo il primo accesso",
            );
          }
        }

        if (category) {
          const { error: categoryError } = await admin
            .from("customer_categories")
            .upsert(
              {
                customer_id: customerId,
                category,
                updated_at:
                  new Date().toISOString(),
              },
              {
                onConflict: "customer_id",
              },
            );

          if (categoryError) {
            console.error(
              "Category assignment failed",
              {
                message: categoryError.message,
              },
            );

            warnings.push("categoria non assegnata");
          }
        }

        return jsonResponse({
          customerId,
          email,
          warnings,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          return jsonResponse(
            { error: error.message },
            error.status,
          );
        }

        console.error("create-customer failed", {
          message:
            error instanceof Error
              ? error.message
              : "unknown",
        });

        return jsonResponse(
          {
            error:
              "Errore imprevisto durante la registrazione del cliente",
          },
          500,
        );
      }
    },
  ),
};
