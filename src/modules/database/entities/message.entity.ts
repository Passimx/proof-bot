import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ChatEntity } from './chat.entity';
import { MessageType } from '../../telegram/types/message.type';

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

  @Column({ name: 'created_at', type: 'timestamptz' })
  readonly createdAt: Date;

  @Column({ name: 'info', type: 'jsonb', nullable: true })
  readonly info: Partial<MessageType>[];

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  readonly user: UserEntity;

  @ManyToOne(() => ChatEntity, (chat) => chat.messages)
  @JoinColumn({ name: 'chat_id' })
  readonly chat: ChatEntity;
}
