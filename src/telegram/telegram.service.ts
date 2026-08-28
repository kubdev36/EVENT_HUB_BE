import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  constructor(private readonly configService: ConfigService) {}

  private get botToken() {
    return this.configService.get<string>('telegram_bot_token');
  }

  private get chatId() {
    return this.configService.get<string>('telegram_chat_id');
  }

  async sendMessage(text: string) {
    if (!this.botToken || !this.chatId) {
      return { ok: false, skipped: true, message: 'Telegram is not configured.' };
    }

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    return response.json();
  }

  async sendPhoto(photoUrl: string, caption: string) {
    if (!this.botToken || !this.chatId) {
      return { ok: false, skipped: true, message: 'Telegram is not configured.' };
    }

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'HTML',
      }),
    });

    return response.json();
  }
}
