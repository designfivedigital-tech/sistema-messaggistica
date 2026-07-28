import { create } from "zustand";

export type ReplyMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
};

type ReplyStore = {
  replyMessage: ReplyMessage | null;

  setReplyMessage: (
    message: ReplyMessage,
  ) => void;

  clearReplyMessage: () => void;
};

export const useReplyStore =
  create<ReplyStore>((set) => ({
    replyMessage: null,

    setReplyMessage: (message) => {
      set({
        replyMessage: message,
      });
    },

    clearReplyMessage: () => {
      set({
        replyMessage: null,
      });
    },
  }));