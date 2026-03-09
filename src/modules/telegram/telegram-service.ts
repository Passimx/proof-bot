import { Injectable } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import words from '../../common/words.json';

import { EntityManager } from 'typeorm';
import { Envs } from '../../common/env/envs';
import { UserEntity } from '../database/entities/user.entity';
import { ChatEntity } from '../database/entities/chat.entity';
import { MessageType } from './types/message.type';
import { EditedMessageType } from './types/edited-message.type';
import { UpdateMyChatMemberType } from './types/update-my-chat-member.type';
import { MessageEntity } from '../database/entities/message.entity';

@Injectable()
export class TelegramService {
  private bot: Telegraf;
  private botInfo: UserEntity;

  constructor(private readonly em: EntityManager) {}

  async onModuleInit() {
    this.bot = new Telegraf(Envs.telegram.botToken);
    this.bot.catch((err) => {
      console.error('Telegraf error:', err);
    });

    this.bot.start(this.onStart);
    this.bot.on('my_chat_member', this.onJoinChat);
    this.bot.on('message', this.onMessage);
    this.bot.on('edited_message', this.onEditMessage);
    await this.getMe();
    void this.bot.launch();
  }

  onModuleDestroy() {
    this.bot.stop();
  }

  onMessage = async (ctx: Context) => {
    const message = ctx.message as unknown as MessageType;
    const { message_id, chat, from, date, ...info } = message;

    if (info.reply_to_message) {
      const context = { message: info.reply_to_message } as unknown as Context;
      await this.onMessage(context);
    }

    await this.em.upsert(
      UserEntity,
      { id: from.id, userName: from.username },
      { conflictPaths: ['id'] },
    );

    await this.em.upsert(
      ChatEntity,
      {
        id: chat.id,
        title: chat.type === 'private' ? chat.username : chat.title,
        type: chat.type,
      },
      { conflictPaths: ['id'] },
    );

    const chatDb = await this.em.findOneOrFail(ChatEntity, {
      where: { id: chat.id },
      relations: ['users'],
    });

    await this.em.insert(MessageEntity, {
      messageId: message_id,
      userId: from.id,
      chatId: message.chat.id,
      createdAt: new Date(date),
      info: [info],
    });

    if (!chatDb.users.find((user) => user.id === from.id)) {
      const userDb = await this.em.findOneOrFail(UserEntity, {
        where: { id: from.id },
      });
      chatDb.users.push(userDb);
      await this.em.save(chatDb);
    }
  };

  onEditMessage = async (ctx: Context) => {
    const update = ctx.update as unknown as EditedMessageType;
    const editedMessage = update.edited_message;
    const { message_id, chat, from, date, ...info } = editedMessage;

    const messageDb = await this.em.findOneOrFail(MessageEntity, {
      where: {
        messageId: message_id,
        chatId: chat.id,
        userId: from.id,
        createdAt: new Date(date),
      },
    });

    messageDb.info.push(info);
    await this.em.save(messageDb);
  };

  onJoinChat = async (ctx: Context) => {
    const chatMember = ctx.update as unknown as UpdateMyChatMemberType;
    const chat = chatMember.my_chat_member.chat;
    const title = chat.type === 'private' ? chat.username : chat.title;

    await this.em.upsert(
      ChatEntity,
      { id: chat.id, title, type: chat.type },
      { conflictPaths: ['id'] },
    );
    const chatDb = (await this.em.findOne(ChatEntity, {
      where: { id: chat.id },
      relations: ['users'],
    }))!;

    if (!chatDb.users.find((user) => user.id === this.botInfo.id)) {
      chatDb.users.push(this.botInfo);
      await this.em.save(chatDb);
    }
  };

  public onStart = async (ctx: Context) => {
    const from = ctx?.from;
    const chat = ctx?.chat;

    await this.em.upsert(
      UserEntity,
      { id: from?.id, userName: from?.username },
      { conflictPaths: ['id'] },
    );

    await this.em.upsert(
      ChatEntity,
      { id: chat?.id, type: 'private', title: from?.username },
      { conflictPaths: ['id'] },
    );

    const chatDb = (await this.em.findOne(ChatEntity, {
      where: { id: chat?.id },
      relations: ['users'],
    }))!;

    if (!chatDb.users.find((user) => user.id === from?.id)) {
      const user = (await this.em.findOne(UserEntity, {
        where: { id: from?.id },
      }))!;
      chatDb.users.push(user);
      await this.em.save(chatDb);
    }

    if (!chatDb.users.find((user) => user.id === this.botInfo.id)) {
      chatDb.users.push(this.botInfo);
      await this.em.save(chatDb);
    }

    const textMessage = await ctx.reply(words['start'], { parse_mode: 'HTML' });

    await this.em.insert(MessageEntity, {
      messageId: textMessage.message_id,
      userId: from?.id,
      chatId: textMessage.chat.id,
      createdAt: new Date(textMessage.date),
      info: [{ text: textMessage.text }],
    });
  };

  private async getMe() {
    const userInfo = await this.bot.telegram.getMe();

    await this.em.upsert(
      UserEntity,
      {
        id: userInfo.id,
        userName: userInfo.username,
      },
      { conflictPaths: ['id'] },
    );

    this.botInfo = (await this.em.findOne(UserEntity, {
      where: { id: userInfo.id },
    }))!;
  }
}
