import { ThumbType } from './thumb.type';

export type VideoNoteType = {
  duration: number;
  length: number;
  thumbnail: ThumbType;
  thumb: ThumbType;
  file_id: string;
  file_unique_id: string;
  file_size: number;
};
