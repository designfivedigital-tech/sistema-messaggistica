export type ChatAttachment = {
  id: string;
  message_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
};

export type ChatReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  reply_to_message_id: string | null;
  delivered_at: string | null;
  read_at: string | null;
  deleted_for_everyone_at: string | null;
  created_at: string;
  message_attachments: ChatAttachment[];
  message_reactions: ChatReaction[];
};

export type SendMessageInput = {
  conversationId: string;
  senderId: string;
  body: string;
  replyToMessageId?: string | null;
};

export type SendAttachmentInput = {
  conversationId: string;
  body: string;
  files: File[];
  replyToMessageId?: string | null;
  onUploadProgress?: (
    completedFiles: number,
    totalFiles: number,
    percentage: number,
  ) => void;
};

export type SetMessageReactionInput = {
  messageId: string;
  conversationId: string;
  userId: string;
  emoji: string;
};

export type RemoveMessageReactionInput = {
  messageId: string;
  conversationId: string;
  userId: string;
};