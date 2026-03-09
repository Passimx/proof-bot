import { ThumbType } from './thumb.type';

export type DocumentType = {
  file_name: string;
  mime_type: string;
  thumbnail?: DocumentType;
  thumb?: ThumbType;
  file_id: string;
  file_unique_id: string;
  file_size: number;
};
