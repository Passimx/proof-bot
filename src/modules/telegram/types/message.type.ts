import { FromType } from './from.type';
import { ChatType } from './chat.type';
import { DocumentType } from './document.type';
import { VoiceType } from './voice.type';
import { VideoNoteType } from './video-note.type';
import { ThumbType } from './thumb.type';
import { VideoType } from './video.type';

export type MessageType = {
  message_id: number;
  from: FromType;
  chat: ChatType;
  date: number;
  edit_date?: number;
  reply_to_message?: MessageType;
  left_chat_participant?: FromType;
  left_chat_member?: FromType;
  new_chat_participant?: FromType;
  new_chat_member?: FromType;
  document?: DocumentType;
  text?: string;
  caption?: string;
  voice?: VoiceType;
  video_note?: VideoNoteType;
  photo?: [ThumbType, ThumbType, ThumbType, ThumbType];
  video?: VideoType;
};
