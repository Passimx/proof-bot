import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ChatEntity } from './chat.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @Column({
    name: 'id',
    type: 'bigint',
    primary: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  readonly id: number;

  @Column({ name: 'is_bot', type: 'boolean', default: false })
  readonly isBot: boolean;

  @Column({ name: 'first_name', type: 'varchar', length: 2 ** 6 })
  readonly firstName: string;

  @Column({ name: 'user_name', type: 'varchar', nullable: true })
  readonly userName: string;

  @Column({
    name: 'language_code',
    type: 'varchar',
    length: 2 ** 4,
    nullable: true,
  })
  readonly languageCode?: string;

  @Column({
    name: 'token',
    type: 'varchar',
    length: 2 ** 6,
    select: false,
    nullable: true,
  })
  readonly token?: string;

  @CreateDateColumn({ name: 'created_at' })
  readonly createdAt: Date;

  @ManyToMany(() => ChatEntity, (chat) => chat.users)
  @JoinTable({
    name: 'users_chats',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'chat_id', referencedColumnName: 'id' },
  })
  readonly chats: ChatEntity[];
}
