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

    if (text.includes('sale') || text.includes('giam gia') || text.includes('uu dai') || text.includes('khuyen mai')) {
      return 'sale';
    }

    if (text.includes('ra mat') || text.includes('mo ban') || text.includes('pre-order') || text.includes('launch')) {
      return 'release';
    }

    if (text.includes('livestream') || text.includes('live stream')) {
      return 'livestream';
    }

    if (text.includes('quang cao') || text.includes('campaign') || text.includes('ads') || text.includes('advert')) {
      return 'ads';
    }

    return 'other';
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
    if (['sale', 'promotion', 'khuyen mai', 'uu dai'].includes(value)) return 'sale';
    if (['livestream', 'live', 'live stream'].includes(value)) return 'livestream';
    if (['ads', 'advert', 'quang cao', 'campaign'].includes(value)) return 'ads';
    if (['other', 'khac'].includes(value)) return 'other';

    return value || 'other';
  }
}
