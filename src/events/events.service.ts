import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventDto } from './dto/create-event.dto.js';
import { Event } from './entity/event.entity.js';
import { Setting } from '../settings/entity/setting.entity.js';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async findLatest(limit = 50) {
    return this.eventRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findAll() {
    return this.eventRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async createManualEvent(data: CreateEventDto) {
    const sourceId = data.sourceId || 'minhtuan';
    const sourceName = data.sourceName || (sourceId === 'minhtuan' ? 'Minh Tuấn Mobile' : 'Manual');
    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const event = this.eventRepository.create({
      sourceId,
      sourceName,
      origin: 'manual',
      sourceUrl: data.url || '',
      title: data.title,
      description: data.description ?? null,
      image: data.image ?? null,
      url: data.url || '',
      eventDate: data.eventDate ? new Date(data.eventDate) : now,
      eventTime: data.eventTime ?? defaultTime,
      type: data.type,
      rawData: { origin: 'manual' },
      contentHash: `manual|${sourceId}|${data.title}|${data.url || ''}|${Date.now()}`,
      firstSeenAt: now,
      lastSeenAt: now,
      notifiedAt: null,
    });

    return this.eventRepository.save(event);
  }

  private formatLocalDate(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async getDashboardData(limit = 500) {
    const [events, settings] = await Promise.all([
      this.eventRepository.find({
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.settingRepository.find(),
    ]);

    const crawlerSetting = settings.find((item) => item.key === 'crawler_sources');
    const sourceList = Array.isArray(crawlerSetting?.value)
      ? crawlerSetting?.value
      : Array.isArray((crawlerSetting?.value as { targets?: unknown[] } | undefined)?.targets)
        ? (crawlerSetting?.value as { targets: Array<Record<string, unknown>> }).targets
        : Array.isArray((crawlerSetting?.value as { sources?: unknown[] } | undefined)?.sources)
          ? (crawlerSetting?.value as { sources: Array<Record<string, unknown>> }).sources
          : [];

    const sourceMap = new Map(
      sourceList.map((item) => {
        const id = String(item.id || '').trim();
        const name = String(item.name || '').trim();
        const logo = this.resolveLogo(id, name, typeof item.logo === 'string' ? item.logo : null);

        return [
          id,
          {
            id,
            name,
            logo,
            targetUrls: Array.isArray(item.targetUrls)
              ? item.targetUrls.filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
              : [],
            enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
            interval: typeof item.interval === 'string' ? item.interval : '6h',
          },
        ];
      }),
    );

    const grouped = new Map<string, {
      id: string;
      name: string;
      logo: string | null;
      targetUrls: string[];
      enabled: boolean;
      interval: string;
      events: Array<Record<string, unknown>>;
    }>();

    // Initialize all sources from settings
    for (const [sId, sMeta] of sourceMap.entries()) {
      grouped.set(sId, { ...sMeta, events: [] });
    }

    for (const event of events) {
      const cleanTitle = this.cleanTitle(event.title);
      const lower = cleanTitle.toLowerCase();

      if (
        !cleanTitle ||
        lower.includes('trang chủ') ||
        lower.includes('trang chu') ||
        lower.includes('giới thiệu về công ty') ||
        lower.includes('giới thiệu công ty') ||
        lower.includes('quy chế') ||
        lower.includes('câu hỏi thường gặp') ||
        lower.includes('tra cứu') ||
        lower.includes('quy trình') ||
        lower.includes('các điều kiện') ||
        lower.includes('dự án doanh nghiệp') ||
        lower.includes('hướng dẫn mua hàng') ||
        lower.includes('đại lý uỷ quyền') ||
        lower.includes('người có ảnh hưởng') ||
        lower.includes('quy định về') ||
        lower.includes('tin tức công nghệ cập nhật 24h') ||
        cleanTitle.length < 8
      ) {
        continue;
      }

      const sourceId = event.sourceId || event.origin || 'manual';
      const sourceName = event.sourceName || sourceId;
      const source = sourceMap.get(sourceId) || {
        id: sourceId,
        name: sourceName,
        logo: this.resolveLogo(sourceId, sourceName),
        targetUrls: [],
        enabled: true,
        interval: '6h',
      };

      if (!grouped.has(sourceId)) {
        grouped.set(sourceId, { ...source, events: [] });
      }

      grouped.get(sourceId)?.events.push({
        id: event.id,
        date: this.formatLocalDate(event.eventDate),
        time: this.formatEventTime(event.eventTime, event.firstSeenAt || event.createdAt),
        type: event.type,
        title: cleanTitle,
        fullTitle: cleanTitle,
        desc: this.cleanCdata(event.description),
        image: event.image,
        url: event.url,
        sourceId: event.sourceId,
        sourceName: event.sourceName,
      });
    }

    const payload = Array.from(grouped.values()).map((item) => ({
      ...item,
      totalEvents: item.events.length,
      stats: item.events.reduce<Record<string, number>>((result, ev) => {
        const key = String(ev.type || 'other');
        result[key] = (result[key] || 0) + 1;
        return result;
      }, {}),
    }));

    return {
      totalEvents: events.length,
      totalSources: payload.length,
      sources: payload,
      events,
    };
  }

  async getEventsByDate(date?: string, limit = 500) {
    const dashboard = await this.getDashboardData(limit);
    const sources = dashboard.sources as Array<{
      events?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    }>;

    const filteredSources = sources
      .map((source) => ({
        ...source,
        events: (source.events || []).filter((event) => {
          if (!date) return true;
          return String(event.date || '') === date;
        }),
      }))
      .filter((source) => source.events.length > 0);

    return {
      date: date || null,
      totalEvents: filteredSources.reduce((acc, source) => acc + source.events.length, 0),
      totalSources: filteredSources.length,
      sources: filteredSources,
    };
  }

  private resolveLogo(id: string, name: string, currentLogo?: string | null): string {
    if (currentLogo && currentLogo.trim().length > 0) {
      return currentLogo;
    }

    const sId = (id || '').toLowerCase().trim();
    const sName = (name || '').toLowerCase().trim();

    if (sId.includes('minhtuan') || sName.includes('minh tuấn') || sName.includes('minh tuan')) return '/img/mtm.jpg';
    if (sId.includes('cellphones') || sName.includes('cellphones')) return '/img/cellphones.png';
    if (sId.includes('hoangha') || sName.includes('hoàng hà') || sName.includes('hoang ha')) return '/img/hoangha.jpg';
    if (sId.includes('fpt') || sName.includes('fpt')) return '/img/fpt.png';
    if (sId.includes('tgdd') || sId.includes('thegioididong') || sName.includes('thế giới di động') || sName.includes('the gioi di dong')) return '/img/tgdd.jpg';
    if (sId.includes('nguyenkim') || sName.includes('nguyễn kim') || sName.includes('nguyen kim')) return '/img/nguyenkim.png';

    return '/img/mtm.jpg';
  }

  private formatEventTime(eventTime?: string | null, dateObj?: Date | null): string {
    if (eventTime && eventTime.trim()) {
      return eventTime.trim();
    }
    if (dateObj) {
      const d = new Date(dateObj);
      if (!Number.isNaN(d.getTime())) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    }
    return '08:00';
  }

  private cleanCdata(text?: string | null): string {
    if (!text) return '';
    return text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
      .replace(/&lt;!\[CDATA\[([\s\S]*?)\]\]&gt;/gi, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&lt;[^&]+&gt;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanTitle(rawTitle?: string | null): string {
    if (!rawTitle) return '';
    let title = this.cleanCdata(rawTitle);

    const authorRegex = /^(nguyễn\s+[a-zà-ỹ\s]{2,15}|lê\s+[a-zà-ỹ\s]{2,15}|trần\s+[a-zà-ỹ\s]{2,15}|phạm\s+[a-zà-ỹ\s]{2,15}|võ\s+[a-zà-ỹ\s]{2,15}|đặng\s+[a-zà-ỹ\s]{2,15}|bùi\s+[a-zà-ỹ\s]{2,15}|nam\s+anh|hải\s+nam|hải\s+trần|công\s+minh|hoàng\s+[a-zà-ỹ\s]{2,15})\s+/i;

    if (authorRegex.test(title)) {
      const stripped = title.replace(authorRegex, '').trim();
      if (stripped.length >= 8) {
        title = stripped;
      }
    }

    return title;
  }
}