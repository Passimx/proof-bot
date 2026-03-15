import { Injectable } from '@nestjs/common';
import { I18nService } from '../i18n/i18n.service';
import { EntityManager } from 'typeorm';
import { Context, Markup } from 'telegraf';
import { ChatEntity } from '../database/entities/chat.entity';
import { UserEntity } from '../database/entities/user.entity';
import { FromType } from './types/from.type';
import { BotActionsEnum } from './types/bot-actions.enum';
import { ChatType } from './types/chat.type';
import { MessageEntity } from '../database/entities/message.entity';
import { MessageType } from './types/message.type';
import { EditedMessageType } from './types/edited-message.type';
import { UpdateMyChatMemberType } from './types/update-my-chat-member.type';

@Injectable()
export class ActionsService {
  private botInfo: UserEntity;

  constructor(
    private readonly em: EntityManager,
    private readonly i18nService: I18nService,
  ) {}

  public setBotInfo(botInfo: UserEntity) {
    this.botInfo = botInfo;
  }

  public backToMenu = async (ctx: Context, next: () => Promise<void>) => {
    const edited_message = await ctx.editMessageText(
      `${this.t(ctx, 'select_action')}:`,
      {
        parse_mode: 'HTML',
        ...this.mainMenu(ctx),
      },
    );

    await next();
    await this.onEditMessage({ update: { edited_message } } as Context);
  };

  public onMenu = async (ctx: Context, next: () => Promise<void>) => {
    const edited_message = await ctx.editMessageText(
      `${this.t(ctx, 'select_action')}:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `⬅️ ${this.t(ctx, 'back')}`,
              BotActionsEnum.BACK_TO_MENU,
            ),
          ],
        ]),
      },
    );

    await next();
    await this.onEditMessage({ update: { edited_message } } as Context);
  };

  onCallbackQuery = async (ctx: Context) => {
    const update = ctx.update as unknown as EditedMessageType;
    if (!update.callback_query) return;

    const { message_id, chat, from, date } = update.callback_query.message;
    const messageDb = await this.em.findOneOrFail(MessageEntity, {
      where: {
        messageId: message_id,
        chatId: chat.id,
        userId: from.id,
        createdAt: new Date(date),
      },
    });
    messageDb.info.push({ data: update.callback_query.data, from });
    await this.em.save(messageDb);
  };

  onEditMessage = async (ctx: Context) => {
    const update = ctx.update as unknown as EditedMessageType;
    if (!update.edited_message) return;

    const { message_id, chat, from, date, ...info } = update.edited_message;
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

  public onExport = async (ctx: Context, next: () => Promise<void>) => {
    const chat = ctx.chat as ChatType;

    const chatDb = await this.em.findOneOrFail(ChatEntity, {
      where: { id: chat.id },
      relations: ['messages'],
      order: { messages: { messageId: 'ASC' } },
    });

    const json = JSON.stringify(chatDb, null, 2);
    const buffer = Buffer.from(json, 'utf-8');

    const message = (await ctx.replyWithDocument({
      source: buffer,
      filename: `chat.json`,
    })) as MessageType;

    await next();

    await this.onMessage({ message } as Context);
  };

  public onStart = async (ctx: Context, next: () => Promise<void>) => {
    const from = ctx.from as FromType;
    const chat = ctx?.chat;

    await this.em.upsert(
      UserEntity,
      {
        id: from?.id,
        userName: from?.username,
        languageCode: from?.language_code,
      },
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

    if (chat?.type === 'private') {
      const message1 = await ctx.reply(this.t(ctx, 'start'), {
        parse_mode: 'HTML',
        disable_notification: true,
      });
      const message2 = await ctx.reply(`${this.t(ctx, 'select_action')}:`, {
        parse_mode: 'HTML',
        ...this.mainMenu(ctx),
      });

      await next();
      await this.onMessage({ message: message1 } as Context);
      await this.onMessage({ message: message2 } as Context);
    } else await next();
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

  onMessage = async (ctx: Context) => {
    const message = ctx.message as unknown as MessageType;
    const { message_id, chat, from, date, ...info } = message;

    if (info.reply_to_message) {
      const context = { message: info.reply_to_message } as unknown as Context;
      await this.onMessage(context);
    }

    await this.em.upsert(
      UserEntity,
      {
        id: from.id,
        userName: from.username,
        languageCode: from.language_code,
      },
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

  private t(ctx: Context | string | undefined, key: string) {
    return this.i18nService.t(
      typeof ctx === 'string' ? ctx : ctx?.from?.language_code,
      key,
    );
  }

  private mainMenu = (ctx: Context | string | undefined) =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `🌐️ ${this.t(ctx, 'menu')}`,
          BotActionsEnum.MENU,
        ),
      ],
    ]);
}
