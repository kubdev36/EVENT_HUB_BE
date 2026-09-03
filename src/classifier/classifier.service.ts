import { Injectable } from '@nestjs/common';

type KeywordRule = {
  type: string;
  keywords: string;
};

@Injectable()
export class ClassifierService {
  classify(title: string, description = '', rules: KeywordRule[] = []): string {
    const text = this.normalize(`${title} ${description}`);

    for (const rule of rules) {
      const keywords = rule.keywords
        .split(',')
        .map((keyword) => this.normalize(keyword))
        .filter(Boolean);

      if (keywords.some((keyword) => text.includes(keyword))) {
        return this.normalizeType(rule.type);
      }
    }

    if (
      text.includes('sale') ||
      text.includes('giam gia') ||
      text.includes('uu dai') ||
      text.includes('khuyen mai') ||
      text.includes('deal') ||
      text.includes('gia soc')
    ) {
      return 'promo';
    }

    if (text.includes('livestream') || text.includes('live stream') || text.includes('live')) {
      return 'live';
    }

    if (text.includes('quang cao') || text.includes('campaign') || text.includes('ads') || text.includes('advert')) {
      return 'ads';
    }

    if (
      text.includes('ra mat') ||
      text.includes('mo ban') ||
      text.includes('pre-order') ||
      text.includes('launch') ||
      text.includes('chinh thuc')
    ) {
      return 'release';
    }

    return 'promo';
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeType(type: string) {
    const value = this.normalize(type);

    if (['release', 'launch', 'ra mat', 'mo ban'].includes(value)) return 'release';
    if (['sale', 'promo', 'promotion', 'khuyen mai', 'uu dai'].includes(value)) return 'promo';
    if (['livestream', 'live', 'live stream'].includes(value)) return 'live';
    if (['ads', 'advert', 'quang cao', 'campaign'].includes(value)) return 'ads';
    if (['internal', 'noi bo'].includes(value)) return 'internal';
    if (['other', 'khac'].includes(value)) return 'other';

    return value || 'promo';
  }
}
