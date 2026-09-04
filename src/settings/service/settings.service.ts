import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrawlSource, CrawlTarget } from '../../crawlers/crawler.types.js';
import { Setting } from '../entity/setting.entity.js';

type SettingsKey = 'crawler_sources' | 'telegram_config' | 'keyword_rules';
type CrawlerSourcesSetting =
  | { targets?: Array<Record<string, unknown>>; sources?: Array<Record<string, unknown>> }
  | Array<Record<string, unknown>>;

const DEFAULT_CRAWLER_SOURCES = [
  {
    id: 'minhtuan',
    name: 'Minh Tuấn Mobile',
    type: 'web',
    logo: '/img/mtm.jpg',
    enabled: true,
    interval: '6h',
    targetUrls: ['https://minhtuanmobile.com/tin-tuc/khuyen-mai/'],
  },
  {
    id: 'cellphones',
    name: 'CellphoneS',
    type: 'web',
    logo: '/img/cellphones.png',
    enabled: true,
    interval: '6h',
    targetUrls: ['https://cellphones.com.vn/sforum/khuyen-mai-soc'],
  },
  {
    id: 'hoangha',
    name: 'Hoàng Hà Mobile',
    type: 'web',
    logo: '/img/hoangha.jpg',
    enabled: true,
    interval: '6h',
    targetUrls: ['https://hoanghamobile.com/tin-tuc/category/khuyen-mai/'],
  },
  {
    id: 'fptshop',
    name: 'FPT Shop',
    type: 'web',
    logo: '/img/fpt.png',
    enabled: true,
    interval: '6h',
    targetUrls: [
      'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai',
      'https://fptshop.com.vn/tin-tuc/tin-moi',
      'https://fptshop.com.vn/tin-tuc/danh-gia',
      'https://fptshop.com.vn/tin-tuc/dien-may',
      'https://fptshop.com.vn/tin-tuc/tin-fstudio',
    ],
  },
  {
    id: 'tgdd',
    name: 'Thế Giới Di Động',
    type: 'web',
    logo: '/img/tgdd.jpg',
    enabled: true,
    interval: '6h',
    targetUrls: [
      'https://www.thegioididong.com/tin-tuc',
      'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai/31',
      'https://www.thegioididong.com/tin-tuc/danh-gia/210',
      'https://www.thegioididong.com/tin-tuc/laptop/1269',
    ],
  },
  {
    id: 'nguyenkim',
    name: 'Nguyễn Kim',
    type: 'web',
    logo: '/img/nguyenkim.png',
    enabled: true,
    interval: '6h',
    targetUrls: ['https://www.nguyenkim.com/khuyen-mai.html'],
  },
];

const DEFAULT_KEYWORD_RULES = [
  { type: 'promo', label: 'Khuyến mãi', keywords: 'khuyen mai, uu dai, giam gia, flash sale, khuyen mai soc, giam gia khung' },
  { type: 'release', label: 'Ra mắt sản phẩm', keywords: 'ra mat, mo ban, launch, unbox, gioi thieu, san pham moi, pre-order' },
  { type: 'live', label: 'Livestream', keywords: 'livestream, live, phat truc tiep, xem live, san deal live' },
  { type: 'ads', label: 'Quảng cáo', keywords: 'quang cao, ads, banner, truyen thong, partner' },
  { type: 'internal', label: 'Sự kiện nội bộ', keywords: 'noi bo, minhtuanmobile, event noi bo, mtm' },
];

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  private async seedDefaults() {
    try {
      const crawlerSetting = await this.settingRepository.findOne({ where: { key: 'crawler_sources' } });
      if (!crawlerSetting || !Array.isArray(crawlerSetting.value) || crawlerSetting.value.length === 0) {
        await this.saveSetting('crawler_sources', DEFAULT_CRAWLER_SOURCES);
      } else if (Array.isArray(crawlerSetting.value)) {
        let modified = false;
        const updated = crawlerSetting.value.map((src: any) => {
          if (src.id === 'cellphones' && src.targetUrls?.[0] !== 'https://cellphones.com.vn/sforum/khuyen-mai-soc') {
            modified = true;
            return { ...src, targetUrls: ['https://cellphones.com.vn/sforum/khuyen-mai-soc'] };
          }
          if (src.id === 'fptshop') {
            modified = true;
            return {
              ...src,
              targetUrls: [
                'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai',
                'https://fptshop.com.vn/tin-tuc/tin-moi',
                'https://fptshop.com.vn/tin-tuc/danh-gia',
                'https://fptshop.com.vn/tin-tuc/dien-may',
                'https://fptshop.com.vn/tin-tuc/tin-fstudio',
              ],
            };
          }
          if (src.id === 'tgdd') {
            modified = true;
            return {
              ...src,
              targetUrls: [
                'https://www.thegioididong.com/tin-tuc',
                'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai/31',
                'https://www.thegioididong.com/tin-tuc/danh-gia/210',
                'https://www.thegioididong.com/tin-tuc/laptop/1269',
              ],
            };
          }
          return src;
        });
        if (modified) {
          await this.saveSetting('crawler_sources', updated);
        }
      }

      const keywordSetting = await this.settingRepository.findOne({ where: { key: 'keyword_rules' } });
      if (!keywordSetting || !Array.isArray(keywordSetting.value) || keywordSetting.value.length === 0) {
        await this.saveSetting('keyword_rules', DEFAULT_KEYWORD_RULES);
      }
    } catch {
      // Ignore initial DB connection timing errors during migrations
    }
  }

  async getAllSettings() {
    const settings = await this.settingRepository.find();

    return settings.reduce<Record<string, unknown>>((result, setting) => {
      result[setting.key] = setting.value;
      return result;
    }, {});
  }

  async saveSetting(key: SettingsKey, value: unknown) {
    let setting = await this.settingRepository.findOne({ where: { key } });
    const normalizedValue = this.normalizeSettingValue(key, value);

    if (!setting) {
      setting = this.settingRepository.create({ key, value: normalizedValue });
    } else {
      setting.value = normalizedValue;
    }

    const saved = await this.settingRepository.save(setting);
    return {
      message: 'Setting saved successfully',
      key: saved.key,
      value: saved.value,
      updatedAt: saved.updatedAt,
    };
  }

  async testTelegramMessage(data: unknown) {
    return {
      message: 'Telegram configuration received',
      data,
    };
  }

  async getCrawlerTarget(id: string): Promise<CrawlTarget> {
    if (!id) {
      throw new NotFoundException('Crawler target id is required.');
    }

    const sources = await this.settingRepository.findOne({ where: { key: 'crawler_sources' } });
    const list = this.getCrawlerSourcesList(sources?.value as CrawlerSourcesSetting | undefined);
    const target = list.find((item: CrawlSource) => item.id === id);

    if (!target) {
      throw new NotFoundException('Crawler target not found.');
    }

    return target as CrawlTarget;
  }

  private normalizeSettingValue(key: SettingsKey, value: unknown) {
    if (key === 'crawler_sources') {
      return this.getCrawlerSourcesList(value as CrawlerSourcesSetting);
    }

    if (key === 'keyword_rules' && this.hasArrayProperty(value, 'rules')) {
      return value.rules;
    }

    return value;
  }

  private getCrawlerSourcesList(value?: CrawlerSourcesSetting) {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeCrawlerTarget(item));
    }

    if (this.hasArrayProperty(value, 'targets')) {
      return value.targets.map((item) => this.normalizeCrawlerTarget(item));
    }

    if (this.hasArrayProperty(value, 'sources')) {
      return value.sources.map((item) => this.normalizeCrawlerTarget(item));
    }

    return [];
  }

  private normalizeCrawlerTarget(item: Record<string, unknown>) {
    const type = item.type === 'facebook' ? 'facebook' : 'web';
    const targetUrls = Array.isArray(item.targetUrls)
      ? item.targetUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      : [];

    return {
      id: String(item.id || '').trim(),
      name: String(item.name || '').trim(),
      type,
      logo: typeof item.logo === 'string' ? item.logo : null,
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      interval: typeof item.interval === 'string' ? item.interval : '6h',
      targetUrls,
    } satisfies CrawlSource;
  }

  private hasArrayProperty<T extends string>(
    value: unknown,
    property: T,
  ): value is Record<T, Array<Record<string, unknown>>> {
    return typeof value === 'object' && value !== null && Array.isArray((value as Record<T, unknown>)[property]);
  }
}
