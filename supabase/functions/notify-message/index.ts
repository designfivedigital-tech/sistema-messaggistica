/// <reference types="npm:@types/node" />
// @deno-types="npm:@types/web-push@3.6.4"

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import webpush from "web-push";

type NotificationRequest = {
  messageId?: string;
  recipientUserId?: string;
  title?: string;
  body?: string;
  conversationId?: string | null;
  url?: string | null;
  icon?: string | null;
  badge?: string | null;
  tag?: string | null;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  deleted_for_everyone_at: string | null;
};

type ConversationRow = {
  id: string;
  customer_id: string;
};

type PushError = Error & {
  statusCode?: number;
  body?: string;
  headers?: Record<string, string>;
};

type DeliveryResult = {
  subscriptionId: string;
  success: boolean;
  expired: boolean;
  statusCode: number | null;
  error: string | null;
};

const DEFAULT_ICON = "/pwa-192x192.png";
const DEFAULT_BADGE = "/pwa-192x192.png";

const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 240;

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

function getRequiredSecret(
  name: string,
): string {
  const value =
    Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(
      `Secret ${name} non configurato`,
    );
  }

  return value;
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function normalizeOptionalString(
  value: unknown,
): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function truncateText(
  value: string,
  maxLength: number,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length <= maxLength
  ) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    maxLength - 1,
  )}…`;
}

function isUuid(
  value: string,
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function normalizeRelativeUrl(
  value: string | null,
  recipientUserId: string,
  companyUserId: string,
): string {
  const fallback =
    recipientUserId === companyUserId
      ? "/azienda"
      : "/chat";

  if (!value) {
    return fallback;
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return fallback;
  }

  return value;
}

function createPushTopic(
  conversationId: string | null,
  messageId: string | null,
): string | undefined {
  const source =
    conversationId ?? messageId;

  if (!source) {
    return undefined;
  }

  const topic = source
    .replace(
      /[^A-Za-z0-9_-]/g,
      "",
    )
    .slice(0, 32);

  return topic || undefined;
}

async function readRequest(
  req: Request,
): Promise<NotificationRequest> {
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    throw new Error(
      "Il corpo della richiesta non è JSON valido",
    );
  }

  if (
    typeof rawBody !== "object" ||
    rawBody === null ||
    Array.isArray(rawBody)
  ) {
    throw new Error(
      "Corpo della richiesta non valido",
    );
  }

  const input =
    rawBody as Record<
      string,
      unknown
    >;

  const messageId =
    normalizeOptionalString(
      input.messageId,
    );

  const recipientUserId =
    normalizeOptionalString(
      input.recipientUserId,
    );

  if (
    !messageId &&
    !recipientUserId
  ) {
    throw new Error(
      "messageId oppure recipientUserId è obbligatorio",
    );
  }

  if (
    messageId &&
    !isUuid(messageId)
  ) {
    throw new Error(
      "messageId non è un UUID valido",
    );
  }

  if (
    recipientUserId &&
    !isUuid(recipientUserId)
  ) {
    throw new Error(
      "recipientUserId non è un UUID valido",
    );
  }

  const conversationId =
    normalizeOptionalString(
      input.conversationId,
    );

  if (
    conversationId &&
    !isUuid(conversationId)
  ) {
    throw new Error(
      "conversationId non è un UUID valido",
    );
  }

  return {
    messageId:
      messageId ?? undefined,

    recipientUserId:
      recipientUserId ??
      undefined,

    title:
      normalizeOptionalString(
        input.title,
      ) ?? undefined,

    body:
      normalizeOptionalString(
        input.body,
      ) ?? undefined,

    conversationId,

    url:
      normalizeOptionalString(
        input.url,
      ),

    icon:
      normalizeOptionalString(
        input.icon,
      ),

    badge:
      normalizeOptionalString(
        input.badge,
      ),

    tag:
      normalizeOptionalString(
        input.tag,
      ),
  };
}

function getStatusCode(
  error: unknown,
): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (
      error as PushError
    ).statusCode === "number"
  ) {
    return (
      error as PushError
    ).statusCode ?? null;
  }

  return null;
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return (
    "Errore Web Push sconosciuto"
  );
}

async function sendToSubscription(
  subscription: PushSubscriptionRow,
  payload: string,
  topic: string | undefined,
): Promise<DeliveryResult> {
  try {
    const response =
      await webpush.sendNotification(
        {
          endpoint:
            subscription.endpoint,

          keys: {
            p256dh:
              subscription.p256dh,

            auth:
              subscription.auth,
          },
        },

        payload,

        {
          TTL:
            60 * 60 * 24,

          urgency: "high",
          topic,
        },
      );

    return {
      subscriptionId:
        subscription.id,

      success: true,
      expired: false,

      statusCode:
        response.statusCode ??
        201,

      error: null,
    };
  } catch (error) {
    const statusCode =
      getStatusCode(error);

    const expired =
      statusCode === 404 ||
      statusCode === 410;

    console.error(
      "Web Push delivery failed",
      {
        subscriptionId:
          subscription.id,

        statusCode,
        expired,

        message:
          getErrorMessage(error),
      },
    );

    return {
      subscriptionId:
        subscription.id,

      success: false,
      expired,
      statusCode,

      error:
        getErrorMessage(error),
    };
  }
}

const vapidSubject =
  getRequiredSecret(
    "VAPID_SUBJECT",
  );

const vapidPublicKey =
  getRequiredSecret(
    "VAPID_PUBLIC_KEY",
  );

const vapidPrivateKey =
  getRequiredSecret(
    "VAPID_PRIVATE_KEY",
  );

const companyUserId =
  getRequiredSecret(
    "COMPANY_USER_ID",
  );

if (!isUuid(companyUserId)) {
  throw new Error(
    "COMPANY_USER_ID non è un UUID valido",
  );
}

webpush.setVapidDetails(
  vapidSubject,
  vapidPublicKey,
  vapidPrivateKey,
);

export default {
  fetch: withSupabase(
    {
      auth: [
        "user",
        "secret",
      ],
    },

    async (req, ctx) => {
      const requestId =
        crypto.randomUUID();

      if (
        req.method !== "POST"
      ) {
        return jsonResponse(
          {
            success: false,
            requestId,
            error:
              "Method not allowed",
          },
          405,
        );
      }

      try {
        const input =
          await readRequest(req);

        const callerUserId =
          ctx.authMode === "user"
            ? (
                typeof ctx
                    .userClaims
                    ?.id ===
                  "string"
                  ? ctx
                      .userClaims
                      .id
                  : typeof ctx
                        .jwtClaims
                        ?.sub ===
                      "string"
                    ? ctx
                        .jwtClaims
                        .sub
                    : null
              )
            : null;

        if (
          ctx.authMode ===
            "user" &&
          !callerUserId
        ) {
          return jsonResponse(
            {
              success: false,
              requestId,

              error:
                "Utente autenticato non riconosciuto",
            },
            401,
          );
        }

        let recipientUserId:
          string;

        let conversationId:
          | string
          | null =
            input.conversationId ??
            null;

        let messageId:
          | string
          | null =
            input.messageId ??
            null;

        let notificationTitle =
          input.title ??
          "Nuovo messaggio";

        let notificationBody =
          input.body ??
          "Hai ricevuto un nuovo messaggio.";

        let unreadCount:
          | number
          | undefined;

        /*
         * MODALITÀ REALE
         *
         * Il frontend passa solamente
         * il messageId.
         */
        if (input.messageId) {
          const {
            data:
              messageResult,

            error:
              messageError,
          } =
            await ctx
              .supabaseAdmin
              .from("messages")
              .select(
                `
                  id,
                  conversation_id,
                  sender_id,
                  body,
                  deleted_for_everyone_at
                `,
              )
              .eq(
                "id",
                input.messageId,
              )
              .maybeSingle();

          if (messageError) {
            console.error(
              "Message lookup failed",
              {
                requestId,
                code:
                  messageError.code,

                message:
                  messageError.message,
              },
            );

            return jsonResponse(
              {
                success: false,
                requestId,

                error:
                  "Impossibile leggere il messaggio",
              },
              500,
            );
          }

          if (!messageResult) {
            return jsonResponse(
              {
                success: false,
                requestId,

                error:
                  "Messaggio non trovato",
              },
              404,
            );
          }

          const message =
            messageResult as MessageRow;

          if (
            ctx.authMode ===
              "user" &&
            message.sender_id !==
              callerUserId
          ) {
            return jsonResponse(
              {
                success: false,
                requestId,

                error:
                  "Non puoi notificare un messaggio inviato da un altro utente",
              },
              403,
            );
          }

          if (
            message
              .deleted_for_everyone_at
          ) {
            return jsonResponse(
              {
                success: false,
                requestId,

                error:
                  "Il messaggio è stato eliminato",
              },
              409,
            );
          }

          const {
            data:
              conversationResult,

            error:
              conversationError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                "conversations",
              )
              .select(
                "id,customer_id",
              )
              .eq(
                "id",
                message
                  .conversation_id,
              )
              .maybeSingle();

          if (
            conversationError
          ) {
            console.error(
              "Conversation lookup failed",
              {
                requestId,

                code:
                  conversationError
                    .code,

                message:
                  conversationError
                    .message,
              },
            );

            return jsonResponse(
              {
                success: false,
                requestId,

                error:
                  "Impossibile leggere la conversazione",
              },
              500,
            );
          }

          if (
            !conversationResult
          ) {
            return jsonResponse(
              {
                success: false,
                requestId,

                error:
                  "Conversazione non trovata",
              },
              404,
            );
          }

          const conversation =
            conversationResult as ConversationRow;

          if (
            message.sender_id ===
            companyUserId
          ) {
            recipientUserId =
              conversation
                .customer_id;

            notificationTitle =
              input.title ??
              "Nuovo messaggio dall’azienda";
          } else if (
            message.sender_id ===
            conversation
              .customer_id
          ) {
            recipientUserId =
              companyUserId;

            notificationTitle =
              input.title ??
              "Nuovo messaggio da un cliente";
          } else {
            return jsonResponse(
              {
                success: false,
                requestId,

                error:
                  "Il mittente non appartiene alla conversazione",
              },
              403,
            );
          }

          conversationId =
            message
              .conversation_id;

          messageId =
            message.id;

          notificationBody =
            input.body ??
            message.body?.trim() ??
            "Hai ricevuto un nuovo messaggio.";

          const {
            count,
            error:
              unreadCountError,
          } =
            await ctx
              .supabaseAdmin
              .from("messages")
              .select(
                "id",
                {
                  count: "exact",
                  head: true,
                },
              )
              .eq(
                "conversation_id",
                conversationId,
              )
              .neq(
                "sender_id",
                recipientUserId,
              )
              .is(
                "read_at",
                null,
              )
              .is(
                "deleted_for_everyone_at",
                null,
              );

          if (
            unreadCountError
          ) {
            console.warn(
              "Unread count query failed",
              {
                requestId,

                message:
                  unreadCountError
                    .message,
              },
            );
          } else {
            unreadCount =
              count ?? 0;
          }
        } else {
          /*
           * MODALITÀ TEST
           *
           * Rimane temporaneamente
           * disponibile per il pulsante
           * di prova.
           */
          if (
            !input
              .recipientUserId
          ) {
            throw new Error(
              "Destinatario non disponibile",
            );
          }

          recipientUserId =
            input
              .recipientUserId;

          if (
            ctx.authMode ===
              "user" &&
            recipientUserId !==
              callerUserId
          ) {
            return jsonResponse(
              {
                success: false,
                requestId,

                error:
                  "La notifica di prova può essere inviata solamente all’utente autenticato",
              },
              403,
            );
          }
        }

        const {
          data:
            subscriptions,

          error:
            subscriptionsError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              "push_subscriptions",
            )
            .select(
              "id,user_id,endpoint,p256dh,auth",
            )
            .eq(
              "user_id",
              recipientUserId,
            );

        if (
          subscriptionsError
        ) {
          console.error(
            "Push subscriptions query failed",
            {
              requestId,

              code:
                subscriptionsError
                  .code,

              message:
                subscriptionsError
                  .message,
            },
          );

          return jsonResponse(
            {
              success: false,
              requestId,

              error:
                "Impossibile leggere le registrazioni push",
            },
            500,
          );
        }

        const typedSubscriptions =
          (
            subscriptions ?? []
          ) as PushSubscriptionRow[];

        if (
          typedSubscriptions
            .length === 0
        ) {
          return jsonResponse({
            success: true,
            requestId,

            recipientUserId,
            subscriptionsFound: 0,

            sent: 0,
            failed: 0,
            removed: 0,

            message:
              "L'utente non possiede dispositivi registrati",
          });
        }

        const title =
          truncateText(
            notificationTitle,
            MAX_TITLE_LENGTH,
          );

        const body =
          truncateText(
            notificationBody,
            MAX_BODY_LENGTH,
          );

        const url =
        normalizeRelativeUrl(
          input.url ?? null,
          recipientUserId,
          companyUserId,
        );

        const payload =
          JSON.stringify({
            type: "message",
            title,
            body,

            icon:
              input.icon ??
              DEFAULT_ICON,

            badge:
              input.badge ??
              DEFAULT_BADGE,

            tag:
              input.tag ??
              (
                conversationId
                  ? `conversation-${conversationId}`
                  : "new-message"
              ),

            renotify: true,

            requireInteraction:
              false,

            unreadCount,

            data: {
              url,
              recipientUserId,
              conversationId,
              messageId,
            },
          });

        const topic =
          createPushTopic(
            conversationId,
            messageId,
          );

        const results =
          await Promise.all(
            typedSubscriptions.map(
              (
                subscription,
              ) =>
                sendToSubscription(
                  subscription,
                  payload,
                  topic,
                ),
            ),
          );

        const expiredIds =
          results
            .filter(
              (result) =>
                result.expired,
            )
            .map(
              (result) =>
                result
                  .subscriptionId,
            );

        let removed = 0;

        if (
          expiredIds.length > 0
        ) {
          const {
            data:
              deletedSubscriptions,

            error:
              deleteError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                "push_subscriptions",
              )
              .delete()
              .in(
                "id",
                expiredIds,
              )
              .select("id");

          if (deleteError) {
            console.error(
              "Expired subscription cleanup failed",
              {
                requestId,

                code:
                  deleteError.code,

                message:
                  deleteError.message,
              },
            );
          } else {
            removed =
              deletedSubscriptions
                ?.length ?? 0;
          }
        }

        const sent =
          results.filter(
            (result) =>
              result.success,
          ).length;

        const failed =
          results.length - sent;

        console.log(
          "Push delivery completed",
          {
            requestId,
            recipientUserId,
            conversationId,
            messageId,

            subscriptionsFound:
              typedSubscriptions
                .length,

            sent,
            failed,
            removed,
          },
        );

        return jsonResponse({
          /*
           * Anche se il destinatario
           * non ha dispositivi registrati,
           * l'elaborazione della funzione
           * è considerata valida.
           */
          success:
            sent > 0 ||
            typedSubscriptions
              .length === 0,

          requestId,
          recipientUserId,
          conversationId,
          messageId,

          subscriptionsFound:
            typedSubscriptions
              .length,

          sent,
          failed,
          removed,

          results:
            results.map(
              (result) => ({
                success:
                  result.success,

                expired:
                  result.expired,

                statusCode:
                  result.statusCode,
              }),
            ),
        });
      } catch (error) {
        console.error(
          "notify-message failed",
          {
            requestId,

            message:
              getErrorMessage(
                error,
              ),
          },
        );

        return jsonResponse(
          {
            success: false,
            requestId,

            error:
              getErrorMessage(
                error,
              ),
          },
          400,
        );
      }
    },
  ),
};