import { create } from "zustand";

type ConversationStore = {
  selectedConversationId: string | null;

  /*
   * Messaggio da raggiungere ed evidenziare
   * all'apertura della conversazione.
   */
  focusedMessageId: string | null;

  selectConversation: (conversationId: string) => void;
  clearSelectedConversation: () => void;

  focusMessage: (
    conversationId: string,
    messageId: string,
  ) => void;
  clearFocusedMessage: () => void;
};

export const useConversationStore = create<ConversationStore>(
  (set) => ({
    selectedConversationId: null,
    focusedMessageId: null,

    selectConversation: (conversationId) => {
      set({
        selectedConversationId: conversationId,
      });
    },

    clearSelectedConversation: () => {
      set({
        selectedConversationId: null,
      });
    },

    focusMessage: (conversationId, messageId) => {
      set({
        selectedConversationId: conversationId,
        focusedMessageId: messageId,
      });
    },

    clearFocusedMessage: () => {
      set({
        focusedMessageId: null,
      });
    },
  }),
);
