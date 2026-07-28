import { create } from "zustand";

type ConversationStore = {
  selectedConversationId: string | null;
  selectConversation: (conversationId: string) => void;
  clearSelectedConversation: () => void;
};

export const useConversationStore = create<ConversationStore>(
  (set) => ({
    selectedConversationId: null,

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
  }),
);