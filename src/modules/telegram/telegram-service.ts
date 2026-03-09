import { Injectable } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import words from '../../common/words.json';

import { EntityManager } from 'typeorm';
import { Envs } from '../../common/env/envs';
import { UserEntity } from '../database/entities/user.entity';
import { ChatEntity } from '../database/entities/chat.entity';
import { MessageEntity } from '../database/entities/message.entity';
import { MessageType } from './types/message.type';
import { EditedMessageType } from './types/edited-message.type';
import { MessageEditHistoryEntity } from '../database/entities/message-edit-history.entity';
import { UpdateMyChatMemberType } from './types/update-my-chat-member.type';
import { DocumentEntity } from '../database/entities/document.entity';

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
    console.log(message);
    const fromUser = message.from;
    const chat = message.chat;
    const title = chat.type === 'private' ? chat.username : chat.title;
    const document = message.document;
    const replyMessage = message.reply_to_message;
    let replyMessageDB: MessageEntity | undefined;

    if (replyMessage) {
      const context = { message: replyMessage } as unknown as Context;
      await this.onMessage(context);
      replyMessageDB = await this.em.findOneOrFail(MessageEntity, {
        where: {
          chatId: replyMessage.chat.id,
          messageId: replyMessage.message_id,
        },
      });
    }

    await this.em.upsert(
      UserEntity,
      { id: fromUser.id, userName: fromUser.username },
      { conflictPaths: ['id'] },
    );

    const chatEntity = {
      id: chat.id,
      title: title,
      type: chat.type,
    };
    await this.em.upsert(ChatEntity, chatEntity, { conflictPaths: ['id'] });

    const chatDb = await this.em.findOneOrFail(ChatEntity, {
      where: { id: chat.id },
      relations: ['users'],
    });

    if (!chatDb.users.find((user) => user.id === fromUser.id)) {
      const userDb = await this.em.findOneOrFail(UserEntity, {
        where: { id: fromUser.id },
      });
      chatDb.users.push(userDb);
      await this.em.save(chatDb);
    }

    if (
      message.left_chat_member ||
      message.left_chat_participant ||
      message.new_chat_member ||
      message.new_chat_participant
    )
      return;

    await this.em.upsert(
      MessageEntity,
      {
        messageId: message.message_id,
        userId: fromUser.id,
        chatId: message.chat.id,
        replyToMessageId: replyMessageDB?.id,
        createdAt: new Date(message.date),
        editDate: message?.edit_date ? new Date(message.date) : undefined,
      },
      { conflictPaths: ['chatId', 'messageId'] },
    );

    if (!message.edit_date) {
      const messageDb = await this.em.findOneOrFail(MessageEntity, {
        where: { chatId: chat.id, messageId: message.message_id },
      });

      await this.em.upsert(
        MessageEditHistoryEntity,
        {
          text: message.text ?? message.caption,
          messageId: messageDb.id,
          editDate: new Date(message.date),
        },
        { conflictPaths: ['messageId', 'editDate'] },
      );
    }

    if (document) {
      const messageDb = await this.em.findOneOrFail(MessageEntity, {
        where: { chatId: message.chat.id, messageId: message.message_id },
      });

      const messageEditHistoryDB = await this.em.findOneOrFail(
        MessageEditHistoryEntity,
        {
          where: { messageId: messageDb.id },
          order: { editDate: 'DESC' },
        },
      );

      await this.em.upsert(
        DocumentEntity,
        {
          fileId: document.file_id,
          fileUniqueId: document.file_unique_id,
          fileName: document.file_name,
          mimeType: document.mime_type,
          fileSize: document.file_size,
          messageEditHistoryId: messageEditHistoryDB.id,
          thumb: document.thumb,
        },
        { conflictPaths: ['fileId', 'fileUniqueId'] },
      );
    }
  };

  onEditMessage = async (ctx: Context) => {
    const update = ctx.update as unknown as EditedMessageType;
    const editedMessage = update.edited_message;
    const chat = update.edited_message.chat;
    const document = editedMessage.document;

    const context = { message: editedMessage } as unknown as Context;
    await this.onMessage(context);

    const messageDb = await this.em.findOneOrFail(MessageEntity, {
      where: { messageId: editedMessage.message_id, chatId: chat.id },
    });

    await this.em.upsert(
      MessageEditHistoryEntity,
      {
        text: editedMessage.caption ?? editedMessage.text,
        messageId: messageDb.id,
        editDate: new Date(editedMessage.edit_date!),
      },
      { conflictPaths: ['messageId', 'editDate'] },
    );

    if (document) {
      const messageEditHistoryDB = await this.em.findOneOrFail(
        MessageEditHistoryEntity,
        {
          where: {
            messageId: messageDb.id,
            editDate: new Date(editedMessage.edit_date!),
          },
        },
      );

      await this.em.upsert(
        DocumentEntity,
        {
          fileId: document.file_id,
          fileUniqueId: document.file_unique_id,
          fileName: document.file_name,
          mimeType: document.mime_type,
          fileSize: document.file_size,
          messageEditHistoryId: messageEditHistoryDB.id,
          thumb: document.thumb,
        },
        { conflictPaths: ['fileId', 'fileUniqueId'] },
      );
    }
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

    chatDb.users.push(this.botInfo);

    const textMessage = await ctx.reply(words['start'], { parse_mode: 'HTML' });

    await this.em.insert(MessageEntity, {
      messageId: textMessage.message_id,
      userId: from?.id,
      chatId: textMessage.chat.id,
      createdAt: new Date(textMessage.date),
    });

    if (!textMessage.edit_date) {
      const messageDb = await this.em.findOneOrFail(MessageEntity, {
        where: { chatId: chat?.id, messageId: textMessage.message_id },
      });

      await this.em.upsert(
        MessageEditHistoryEntity,
        {
          text: textMessage.text,
          messageId: messageDb.id,
          editDate: new Date(textMessage.date),
        },
        { conflictPaths: ['messageId', 'editDate'] },
      );
    }
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
