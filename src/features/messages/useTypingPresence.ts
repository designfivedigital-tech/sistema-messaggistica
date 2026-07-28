import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

import type {
  TypingPresencePayload,
  TypingRole,
  TypingUser,
} from "./typingTypes";

type UseTypingPresenceOptions = {
  conversationId: string | null;
  currentUserId: string | null;
  displayName: string;
  role: TypingRole | null;
  enabled?: boolean;
};

type PresenceState = Record<
  string,
  Array<
    TypingPresencePayload & {
      presence_ref?: string;
    }
  >
>;

function getPresenceUsers(
  state: PresenceState,
  currentUserId: string,
): TypingUser[] {
  const usersById = new Map<
    string,
    TypingUser
  >();

  Object.values(state)
    .flat()
    .forEach((presence) => {
      if (
        !presence.userId ||
        presence.userId === currentUserId
      ) {
        return;
      }

      const existingUser = usersById.get(
        presence.userId,
      );

      const currentUpdatedAt = new Date(
        presence.updatedAt,
      ).getTime();

      const existingUpdatedAt = existingUser
        ? new Date(
            existingUser.updatedAt,
          ).getTime()
        : 0;

      if (
        !existingUser ||
        currentUpdatedAt >= existingUpdatedAt
      ) {
        usersById.set(presence.userId, {
          userId: presence.userId,
          displayName:
            presence.displayName || "Utente",
          role: presence.role,
          isTyping: Boolean(
            presence.isTyping,
          ),
          updatedAt: presence.updatedAt,
        });
      }
    });

  return Array.from(usersById.values());
}

export function useTypingPresence({
  conversationId,
  currentUserId,
  displayName,
  role,
  enabled = true,
}: UseTypingPresenceOptions) {
  const [onlineUsers, setOnlineUsers] =
    useState<TypingUser[]>([]);

  const channelRef =
    useRef<RealtimeChannel | null>(null);

  const presenceDataRef = useRef({
    currentUserId,
    displayName,
    role,
  });

  useEffect(() => {
    presenceDataRef.current = {
      currentUserId,
      displayName,
      role,
    };
  }, [currentUserId, displayName, role]);

  const setTyping = useCallback(
    async (isTyping: boolean): Promise<void> => {
      const channel = channelRef.current;

      const {
        currentUserId: activeUserId,
        displayName: activeDisplayName,
        role: activeRole,
      } = presenceDataRef.current;

      if (
        !channel ||
        !activeUserId ||
        !activeRole
      ) {
        return;
      }

      const payload: TypingPresencePayload = {
        userId: activeUserId,
        displayName:
          activeDisplayName || "Utente",
        role: activeRole,
        isTyping,
        updatedAt: new Date().toISOString(),
      };

      const result = await channel.track(
        payload,
      );

      if (result !== "ok") {
        console.error(
          "Errore aggiornamento Presence:",
          result,
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !enabled ||
      !conversationId ||
      !currentUserId ||
      !role
    ) {
      channelRef.current = null;
      setOnlineUsers([]);
      return;
    }

    const activeConversationId =
      conversationId;

    const activeUserId = currentUserId;
    const activeRole = role;

    const activeDisplayName =
      displayName || "Utente";

    const channel = supabase.channel(
      `typing:${activeConversationId}`,
      {
        config: {
          presence: {
            key: activeUserId,
          },
        },
      },
    );

    channelRef.current = channel;

    function updatePresenceUsers() {
      const rawState =
        channel.presenceState();

      const presenceState =
        rawState as unknown as PresenceState;

      setOnlineUsers(
        getPresenceUsers(
          presenceState,
          activeUserId,
        ),
      );
    }

    channel
      .on(
        "presence",
        {
          event: "sync",
        },
        updatePresenceUsers,
      )
      .on(
        "presence",
        {
          event: "join",
        },
        updatePresenceUsers,
      )
      .on(
        "presence",
        {
          event: "leave",
        },
        updatePresenceUsers,
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const initialPayload: TypingPresencePayload =
            {
              userId: activeUserId,
              displayName:
                activeDisplayName,
              role: activeRole,
              isTyping: false,
              updatedAt:
                new Date().toISOString(),
            };

          const result = await channel.track(
            initialPayload,
          );

          if (result !== "ok") {
            console.error(
              "Errore inizializzazione Presence:",
              result,
            );
          }

          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.error(
            "Errore canale Presence:",
            status,
          );
        }
      });

    return () => {
      if (channelRef.current === channel) {
        channelRef.current = null;
      }

      setOnlineUsers([]);

      void channel
        .untrack()
        .finally(() => {
          void supabase.removeChannel(
            channel,
          );
        });
    };
  }, [
    conversationId,
    currentUserId,
    displayName,
    enabled,
    role,
  ]);

  const typingUsers = onlineUsers.filter(
    (presenceUser) =>
      presenceUser.isTyping,
  );

  return {
    onlineUsers,
    typingUsers,
    setTyping,
  };
}