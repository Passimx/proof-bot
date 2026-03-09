import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { MessageEntity } from './message.entity';

@Entity({ name: 'message_edit_histories' })
@Unique(['messageId', 'editDate'])
export class MessageEditHistoryEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  readonly id: string;

  @Column({ name: 'text', type: 'varchar', length: 2 ** 10, nullable: true })
  readonly text: string;

  @Column({ name: 'message_id' })
  readonly messageId: string;

  @CreateDateColumn({ name: 'edit_date' })
  readonly editDate: Date;

  @ManyToOne(() => MessageEntity)
  @JoinColumn({ name: 'message_id' })
  readonly message: MessageEntity;
}
