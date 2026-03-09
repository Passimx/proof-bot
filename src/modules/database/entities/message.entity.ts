import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ChatEntity } from './chat.entity';
import { MessageEditHistoryEntity } from './message-edit-history.entity';

@Entity({ name: 'messages' })
@Unique(['chatId', 'messageId'])
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  readonly id: string;

  @Column({ name: 'message_id', type: 'varchar', length: 2 ** 4 })
  readonly messageId: number;

  @Column({ name: 'user_id', type: 'bigint' })
  readonly userId: number;

  @Column({ name: 'chat_id', type: 'varchar', length: 2 ** 4 })
  readonly chatId: number;

  @Column({ name: 'reply_to_message_id', nullable: true })
  readonly replyToMessageId: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  readonly createdAt: Date;

  @Column({ name: 'edit_date', type: 'timestamptz', nullable: true })
  readonly editDate: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  readonly user: UserEntity;

  @ManyToOne(() => ChatEntity, (chat) => chat.messages)
  @JoinColumn({ name: 'chat_id' })
  readonly chat: ChatEntity;

  @ManyToOne(() => MessageEntity)
  @JoinColumn({ name: 'reply_to_message_id' })
  readonly replyToMessage: MessageEntity;

  @OneToMany(
    () => MessageEditHistoryEntity,
    (messageEditHistory) => messageEditHistory.message,
  )
  readonly messageEditHistories: MessageEditHistoryEntity[];
}
