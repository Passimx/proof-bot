import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import * as thumbType from '../../telegram/types/thumb.type';
import { MessageEditHistoryEntity } from './message-edit-history.entity';

@Entity({ name: 'documents' })
export class DocumentEntity {
  @Column({ name: 'file_id', type: 'varchar', primary: true, length: 2 ** 7 })
  readonly fileId: string;

  @Column({
    name: 'file_unique_id',
    type: 'varchar',
    primary: true,
    length: 2 ** 7,
  })
  readonly fileUniqueId: string;

  @Column({ name: 'file_name', type: 'varchar', length: 2 ** 8 })
  readonly fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 2 ** 8 })
  readonly mimeType: string;

  @Column({ name: 'file_size', type: 'bigint' })
  readonly fileSize: number;

  @Column({ name: 'message_edit_history_id' })
  readonly messageEditHistoryId: string;

  @Column({ nullable: true, type: 'jsonb' })
  readonly thumb?: thumbType.ThumbType;

  @ManyToOne(() => MessageEditHistoryEntity)
  @JoinColumn({ name: 'message_edit_history_id' })
  readonly messageEditHistory: MessageEditHistoryEntity;
}
