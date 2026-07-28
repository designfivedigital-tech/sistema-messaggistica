export type TypingRole =
  | "customer"
  | "company";

export type TypingUser = {
  userId: string;
  displayName: string;
  role: TypingRole;
  isTyping: boolean;
  updatedAt: string;
};

export type TypingPresencePayload =
  TypingUser;