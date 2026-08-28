import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { ClassifierService } from '../../classifier/classifier.service';
import { CrawlerRun } from '../../crawler-runs/entity/crawler-run.entity';
import { Event } from '../../events/entity/event.entity';
import { Setting } from '../../settings/entity/setting.entity';
import { TelegramService } from '../../telegram/telegram.service';
import { CrawlSource, CrawlTarget, KeywordRule, ParsedCrawlItem } from '../crawler.types';

@Injectable()
export class CrawlerService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(CrawlerRun)
    private readonly crawlerRunRepository: Repository<CrawlerRun>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly classifierService: ClassifierService,
    private readonly telegramService: TelegramService,
  ) {}

  async crawlAllSources() {
    return this.crawlAllTargets();
  }

  async crawlAllTargets() {
    const targets = (await this.getCrawlerTargets()).filter((target) => target.enabled !== false);
    return Promise.all(targets.map((target) => this.crawlTargetSafely(target)));
  }

  async crawlSourceById(id: string) {
    return this.crawlTargetById(id);
  }

  async crawlTargetById(id: string) {
    const target = await this.getCrawlerTargetById(id);
    return this.crawlTarget(target);
  }

  async crawlSource(source: CrawlSource) {
    return this.crawlTarget(source);
  }

  async crawlTarget(target: CrawlTarget) {
    const run = await this.crawlerRunRepository.save(
      this.crawlerRunRepository.create({
        sourceId: target.id,
        sourceName: target.name,
        status: 'running',
        startedAt: new Date(),
        itemsFound: 0,
        newItems: 0,
        errorMessage: null,
      }),
    );

    try {
      const items = await this.fetchItemsFromTarget(target);
      const rules = await this.getKeywordRules();
      const seen = new Set<string>();
      let newItems = 0;

      for (const item of items) {
        const itemKey = `${item.url}|${this.normalizeText(item.title)}`;
        if (seen.has(itemKey)) continue;
        seen.add(itemKey);

        const type = this.classifierService.classify(item.title, item.description || '', rules);
        const existing = await this.findExistingEvent(target, item);

        if (existing) {
          existing.lastSeenAt = new Date();
          existing.title = item.title;
          existing.description = item.description ?? existing.description;
          existing.image = item.image ?? existing.image;
          existing.eventDate = item.eventDate ?? existing.eventDate;
          existing.eventTime = item.eventTime ?? existing.eventTime;
          existing.rawData = item.rawData ?? existing.rawData;
          existing.type = type;
          await this.eventRepository.save(existing);
          continue;
        }

        const event = await this.createOrMergeEvent(target, item, type);
        if (!event) continue;

        newItems += 1;
        await this.notifyNewCrawlerEvent(event);
      }

      run.status = 'success';
      run.itemsFound = items.length;
      run.newItems = newItems;
      run.finishedAt = new Date();
      await this.crawlerRunRepository.save(run);

      return {
        sourceId: target.id,
        sourceName: target.name,
        type: target.type || 'web',
        itemsFound: items.length,
        newItems,
        status: 'success',
      };
    } catch (error) {
      run.status = 'failed';
      run.errorMessage = error instanceof Error ? error.message : 'Unknown crawler error';
      run.finishedAt = new Date();
      await this.crawlerRunRepository.save(run);
      throw error;
    }
  }

  private async crawlTargetSafely(target: CrawlTarget) {
    try {
      return await this.crawlTarget(target);
    } catch (error) {
      return {
        sourceId: target.id,
        sourceName: target.name,
        type: target.type || 'web',
        itemsFound: 0,
        newItems: 0,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown crawler error',
      };
    }
  }

  private async getCrawlerTargets(): Promise<CrawlTarget[]> {
    const setting = await this.settingRepository.findOne({ where: { key: 'crawler_sources' } });
    if (Array.isArray(setting?.value)) return setting.value as CrawlTarget[];
    return [];
  }

  private async getCrawlerTargetById(id: string): Promise<CrawlTarget> {
    const targets = await this.getCrawlerTargets();
    const target = targets.find((item) => item.id === id);
    if (!target) throw new Error('Crawler target not found.');
    return target;
  }

  private async getKeywordRules(): Promise<KeywordRule[]> {
    const setting = await this.settingRepository.findOne({ where: { key: 'keyword_rules' } });
    return Array.isArray(setting?.value) ? (setting.value as KeywordRule[]) : [];
  }

  private async fetchItemsFromTarget(target: CrawlTarget): Promise<ParsedCrawlItem[]> {
    if (target.type === 'facebook') {
      return this.fetchFacebookItems(target);
    }

    return this.fetchWebItems(target);
  }

  private async fetchFacebookItems(target: CrawlTarget): Promise<ParsedCrawlItem[]> {
    const items: ParsedCrawlItem[] = [];

    for (const url of target.targetUrls || []) {
      const response = await this.fetchHtml(url);
      if (!response) continue;

      const $ = cheerio.load(response.html);
      const metadataItems = this.extractFromMetadata($, response.url);

      items.push(
        ...metadataItems.map((item) => ({
          ...item,
          rawData: { ...item.rawData, kind: 'facebook-best-effort', sourceUrl: response.url },
        })),
      );
    }

    return this.dedupeAndRankItems(items);
  }

  private async fetchWebItems(target: CrawlTarget): Promise<ParsedCrawlItem[]> {
    const items: ParsedCrawlItem[] = [];

    for (const url of target.targetUrls || []) {
      const response = await this.fetchHtml(url);
      if (!response) continue;

      const $ = cheerio.load(response.html);
      items.push(...this.extractFromMetadata($, response.url));
      items.push(...(await this.extractFromEventBlocks($, response.url)));
      items.push(...(await this.extractFromLinks($, response.url)));
    }

    return this.dedupeAndRankItems(items);
  }

  private async fetchHtml(url: string) {
    const attempts = [url];

    if (url.startsWith('https://')) {
      attempts.push(url.replace('https://', 'http://'));
    }

    for (const attemptUrl of attempts) {
      for (let retry = 0; retry < 3; retry += 1) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);

          const response = await fetch(attemptUrl, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
              'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
              'cache-control': 'no-cache',
              pragma: 'no-cache',
              'sec-fetch-dest': 'document',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'none',
              'upgrade-insecure-requests': '1',
            },
          });

          clearTimeout(timeout);
          if (!response.ok) continue;

          return {
            url: attemptUrl,
            html: await response.text(),
          };
        } catch {
          if (retry === 2) continue;
        }
      }
    }

    return null;
  }

  private extractFromMetadata($: cheerio.CheerioAPI, sourceUrl: string): ParsedCrawlItem[] {
    const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;
    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      this.extractJsonLdImage($) ||
      null;
    const canonical = $('link[rel="canonical"]').attr('href') || sourceUrl;
    const published = this.parsePublishedDate(
      $('meta[property="article:published_time"]').attr('content') ||
        $('meta[property="og:updated_time"]').attr('content') ||
        $('meta[name="pubdate"]').attr('content') ||
        $('time[datetime]').first().attr('datetime') ||
        $('time').first().text().trim() ||
        null,
    );

    if (!title) return [];
    if (this.isGenericListingPage(title, sourceUrl, description || '')) return [];

    return [
      {
        title: title.trim(),
        description: description?.trim() || null,
        image: image ? this.resolveUrl(sourceUrl, image) : null,
        url: this.resolveUrl(sourceUrl, canonical),
        eventDate: published?.date ?? null,
        eventTime: published?.time ?? null,
        score: 2,
        rawData: { kind: 'metadata', sourceUrl },
      },
    ];
  }

  private async extractFromEventBlocks($: cheerio.CheerioAPI, sourceUrl: string): Promise<ParsedCrawlItem[]> {
    const items: ParsedCrawlItem[] = [];
    const selectors = [
      'article',
      'section',
      '[class*="event"]',
      '[class*="promo"]',
      '[class*="sale"]',
      '[class*="livestream"]',
      '[class*="news"]',
      '[class*="post"]',
      '[class*="banner"]',
      '[class*="campaign"]',
      '[class*="product"]',
    ];

    const blocks = $(selectors.join(',')).toArray();

    for (const el of blocks) {
      const block = $(el);
      const href = this.findBestHref($, block, sourceUrl);
      const title =
        block.find('h1, h2, h3, h4, h5').first().text().replace(/\s+/g, ' ').trim() ||
        block.attr('aria-label') ||
        block.text().replace(/\s+/g, ' ').trim();

      if (!href || title.length < 8) continue;

      const description = block.find('p').first().text().replace(/\s+/g, ' ').trim() || null;
      const absoluteUrl = this.resolveUrl(sourceUrl, href);
      const image = (await this.findBestImage($, block, sourceUrl)) || (await this.fetchDetailImage(absoluteUrl, sourceUrl));
      const published = this.parsePublishedDate(
        block.find('meta[property="article:published_time"]').attr('content') ||
          block.find('meta[name="pubdate"]').attr('content') ||
          block.find('time[datetime]').first().attr('datetime') ||
          block.find('time').first().text().trim() ||
          block.text().match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?\b/)?.[0] ||
          null,
      );
      const score = this.scoreText(`${title} ${description || ''}`) + (image ? 1 : 0);

      if (score < 3) continue;
      if (!this.isLikelyEventUrl(absoluteUrl) && score < 4) continue;
      if (this.isNoiseLink(absoluteUrl, title, description || '')) continue;

      items.push({
        title,
        description,
        image,
        url: absoluteUrl,
        eventDate: published?.date ?? null,
        eventTime: published?.time ?? null,
        score,
        rawData: { kind: 'event-block', sourceUrl },
      });
    }

    return items;
  }

  private async extractFromLinks($: cheerio.CheerioAPI, sourceUrl: string): Promise<ParsedCrawlItem[]> {
    const items: ParsedCrawlItem[] = [];

    const links = $('a[href]').toArray();

    for (const el of links) {
      const link = $(el);
      const href = link.attr('href');
      const title = link.text().replace(/\s+/g, ' ').trim();
      if (!href || title.length < 8) continue;

      const context = link.closest('article, section, li, div, main');
      const contextText = context.text().replace(/\s+/g, ' ').trim();
      const absoluteUrl = this.resolveUrl(sourceUrl, href);
      const combined = this.normalizeText(`${title} ${contextText}`);
      const image =
        (await this.findBestImage($, context.length ? context : link, sourceUrl)) ||
        (await this.fetchDetailImage(absoluteUrl, sourceUrl));
      const score = this.scoreText(combined) + (image ? 1 : 0);
      const published = this.parsePublishedDate(
        context.find('meta[property="article:published_time"]').attr('content') ||
          context.find('meta[name="pubdate"]').attr('content') ||
          context.find('time[datetime]').first().attr('datetime') ||
          context.find('time').first().text().trim() ||
          contextText.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?\b/)?.[0] ||
          contextText.match(/\b\d{1,2}:\d{2}\b/)?.[0] ||
          null,
      );

      if (score < 3 && !/(khuyen mai|sale|uu dai|livestream|ra mat|su kien|quang cao|event|promotion|launch)/.test(combined)) continue;
      if (!this.isLikelyEventUrl(absoluteUrl)) continue;
      if (this.isNoiseLink(absoluteUrl, title, contextText)) continue;

      items.push({
        title,
        description: contextText || null,
        image,
        url: absoluteUrl,
        eventDate: published?.date ?? null,
        eventTime: published?.time ?? null,
        score,
        rawData: { kind: 'keyword-link', sourceUrl },
      });
    }

    return items;
  }

  private async findExistingEvent(target: CrawlTarget, item: ParsedCrawlItem) {
    const byUrl = await this.eventRepository.findOne({
      where: { sourceId: target.id, url: item.url },
    });
    if (byUrl) return byUrl;

    const byHash = await this.eventRepository.findOne({
      where: {
        sourceId: target.id,
        contentHash: this.buildContentHash(target.id, item.url, item.title, item.description || ''),
      },
    });
    if (byHash) return byHash;

    const latest = await this.eventRepository.find({
      where: { sourceId: target.id },
      order: { createdAt: 'DESC' },
      take: 200,
    });

    return latest.find((event) => event.url === item.url && this.titleSimilarity(event.title, item.title) >= 0.75) || null;
  }

  private async createOrMergeEvent(target: CrawlTarget, item: ParsedCrawlItem, type: string) {
    const payload = this.eventRepository.create({
      sourceId: target.id,
      sourceName: target.name,
      origin: 'crawler',
      sourceUrl: (item.rawData?.sourceUrl as string) || item.url,
      title: item.title,
      description: item.description ?? null,
      image: item.image ?? null,
      url: item.url,
      eventDate: item.eventDate ?? null,
      eventTime: item.eventTime ?? null,
      type,
      rawData: item.rawData ?? null,
      contentHash: this.buildContentHash(target.id, item.url, item.title, item.description || ''),
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      notifiedAt: null,
    });

    try {
      return await this.eventRepository.save(payload);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const existing = await this.eventRepository.findOne({
          where: [
            { sourceId: target.id, url: item.url },
            { sourceId: target.id, contentHash: payload.contentHash },
          ],
        });

        if (existing) {
          existing.lastSeenAt = new Date();
          existing.title = item.title;
          existing.description = item.description ?? existing.description;
          existing.image = item.image ?? existing.image;
          existing.eventDate = item.eventDate ?? existing.eventDate;
          existing.eventTime = item.eventTime ?? existing.eventTime;
          existing.rawData = item.rawData ?? existing.rawData;
          existing.type = type;
          return this.eventRepository.save(existing);
        }

        return null;
      }

      throw error;
    }
  }

  private findBestHref($: cheerio.CheerioAPI, block: cheerio.Cheerio<AnyNode>, sourceUrl: string) {
    const hrefs = block
      .find('a[href]')
      .map((_, a) => $(a).attr('href'))
      .get()
      .filter(Boolean) as string[];
    const fallback = block.closest('a[href]').attr('href') || hrefs[0] || null;
    return hrefs.find((href) => this.isLikelyEventUrl(this.resolveUrl(sourceUrl, href))) || fallback;
  }

  private findBestImage($: cheerio.CheerioAPI, block: cheerio.Cheerio<AnyNode>, sourceUrl: string) {
    const candidates: Array<string | undefined> = [];

    block.find('img').each((_, img) => {
      const image = $(img);
      const parent = image.closest('picture, figure, a, div');
      candidates.push(
        parent.find('source[type*="image"]').attr('srcset'),
        parent.find('source').attr('srcset'),
        image.attr('data-srcset'),
        image.attr('data-lazy-srcset'),
        image.attr('data-original-set'),
        image.attr('srcset'),
        image.attr('data-thumb'),
        image.attr('data-thumbnail'),
        image.attr('data-src'),
        image.attr('data-lazy-src'),
        image.attr('data-original'),
        image.attr('data-url'),
        image.attr('data-img'),
        image.attr('data-image'),
        image.attr('data-bg'),
        image.attr('data-background'),
        image.attr('data-background-image'),
        image.attr('data-original'),
        image.attr('src'),
      );
    });

    block.find('[style]').each((_, el) => {
      candidates.push(this.extractBackgroundImage($(el).attr('style')));
    });

    return (
      candidates
        .filter(Boolean)
        .flatMap((candidate) => this.expandImageCandidates(candidate as string))
        .map((candidate) => this.resolveUrl(sourceUrl, candidate))
        .find((candidate) => !this.isNoiseImage(candidate) && !this.isVideoUrl(candidate)) || null
    );
  }

  private async fetchDetailImage(url: string, sourceUrl: string) {
    const detail = await this.fetchHtml(url);
    if (!detail) return null;

    const $ = cheerio.load(detail.html);
    const image =
      this.findBestImage($, $('article, main, .article, .post, .detail, .content, .news-detail, .entry-content').first(), detail.url) ||
      this.findBestImage($, $('body'), detail.url) ||
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      this.extractJsonLdImage($) ||
      null;

    if (!image) return null;
    const resolved = this.resolveUrl(detail.url || sourceUrl, image);
    return this.isNoiseImage(resolved) || this.isVideoUrl(resolved) ? null : resolved;
  }

  private isGenericListingPage(title: string, sourceUrl: string, description: string) {
    const combined = this.normalizeText(`${title} ${description} ${sourceUrl}`);
    return (
      /danh sach|category|tin tuc|news|khuyen mai|uu dai|su kien|event|promotion/.test(combined) &&
      !/(ra mat|mo ban|livestream|launch|sale|campaign)/.test(combined) &&
      this.normalizeText(title).length < 80
    );
  }

  private expandImageCandidates(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('data:')) return [];

    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((part) => part.trim().split(/\s+/)[0])
        .filter(Boolean)
        .reverse();
    }

    return [trimmed.split(/\s+/)[0]].filter(Boolean);
  }

  private extractBackgroundImage(style?: string) {
    if (!style) return undefined;
    return style.match(/background(?:-image)?:\s*url\((['"]?)(.*?)\1\)/i)?.[2];
  }

  private extractJsonLdImage($: cheerio.CheerioAPI) {
    let image: string | null = null;

    $('script[type="application/ld+json"]').each((_, script) => {
      if (image) return;

      try {
        const json = JSON.parse($(script).text());
        image = this.findImageInJsonLd(json);
      } catch {
        // Ignore invalid JSON-LD blocks from third-party scripts.
      }
    });

    return image;
  }

  private findImageInJsonLd(value: unknown): string | null {
    if (!value) return null;

    if (Array.isArray(value)) {
      for (const item of value) {
        const image = this.findImageInJsonLd(item);
        if (image) return image;
      }
      return null;
    }

    if (typeof value !== 'object') return null;

    const record = value as Record<string, unknown>;
    const candidate = record.image || record.thumbnailUrl;

    if (typeof candidate === 'string') return candidate;
    if (Array.isArray(candidate)) {
      const first = candidate.find((item) => typeof item === 'string');
      if (typeof first === 'string') return first;
    }
    if (candidate && typeof candidate === 'object') {
      const url = (candidate as Record<string, unknown>).url;
      if (typeof url === 'string') return url;
    }

    for (const child of Object.values(record)) {
      const image = this.findImageInJsonLd(child);
      if (image) return image;
    }

    return null;
  }

  private dedupeAndRankItems(items: ParsedCrawlItem[]) {
    const seen = new Set<string>();

    return items
      .filter((item) => item.title && item.url)
      .filter((item) => {
        const key = `${item.url}|${this.normalizeText(item.title)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 100);
  }

  private titleSimilarity(a: string, b: string) {
    const left = new Set(this.normalizeText(a).split(' ').filter(Boolean));
    const right = new Set(this.normalizeText(b).split(' ').filter(Boolean));
    if (!left.size || !right.size) return 0;

    const intersection = [...left].filter((word) => right.has(word)).length;
    return intersection / Math.max(left.size, right.size);
  }

  private scoreText(text: string) {
    const value = this.normalizeText(text);
    let score = 0;
    const weights: Array<[string, number]> = [
      ['ra mat', 4],
      ['mo ban', 4],
      ['khuyen mai', 4],
      ['uu dai', 3],
      ['sale', 3],
      ['livestream', 4],
      ['quang cao', 2],
      ['campaign', 2],
      ['event', 3],
      ['launch', 3],
      ['promotion', 3],
      ['flash sale', 4],
      ['pre order', 3],
      ['dang ky', 2],
    ];

    for (const [keyword, weight] of weights) {
      if (value.includes(keyword)) score += weight;
    }

    return score;
  }

  private normalizeText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9:/.\-\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveUrl(baseUrl: string, targetUrl: string) {
    try {
      return new URL(targetUrl, baseUrl).toString();
    } catch {
      return targetUrl;
    }
  }

  private isLikelyEventUrl(url: string) {
    const value = this.normalizeText(url);
    if (!value) return false;
    if (value.startsWith('tel:') || value.startsWith('mailto:')) return false;
    if (value.includes('/tos') || value.includes('/privacy') || value.includes('/chinh-sach')) return false;
    if (value.includes('xem tat ca') || value.includes('chinh sach bao mat')) return false;
    if (value.includes('mobile.html') && !value.includes('khuyen-mai') && !value.includes('uu-dai') && !value.includes('livestream')) return false;

    return /khuyen-mai|uu-dai|sale|livestream|ra-mat|mo-ban|su-kien|promotion|event|launch|campaign|flash-sale/.test(value);
  }

  private isNoiseLink(url: string, title: string, contextText: string) {
    const combined = this.normalizeText(`${url} ${title} ${contextText}`);
    return (
      combined.startsWith('tel:') ||
      combined.includes('1800.2063') ||
      combined.includes('1800.2097') ||
      combined.includes('chinh sach bao mat') ||
      combined.includes('dang ky nhan tin') ||
      combined.includes('xem tat ca') ||
      combined.includes('dieu khoan') ||
      (combined.includes('mobile.html') && !combined.includes('khuyen mai') && !combined.includes('uu dai'))
    );
  }

  private isNoiseImage(url: string) {
    const value = this.normalizeText(url);
    return (
      value.includes('favicon') ||
      (value.includes('logo') && !value.includes('banner')) ||
      value.includes('sprite') ||
      value.includes('placeholder') ||
      value.includes('blank') ||
      value.includes('default') ||
      value.includes('avatar') ||
      value.includes('icon') ||
      value.includes('video') ||
      value.includes('thumb')
    );
  }

  private isVideoUrl(url: string) {
    const value = this.normalizeText(url);
    return (
      value.includes('.mp4') ||
      value.includes('.webm') ||
      value.includes('.mov') ||
      value.includes('.m3u8') ||
      value.includes('video') ||
      value.includes('facebook.com/watch') ||
      value.includes('youtu.be') ||
      value.includes('youtube.com/watch')
    );
  }

  private parsePublishedDate(raw: string | null) {
    if (!raw) return null;
    const value = raw.trim();
    if (!value) return null;

    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return { date: direct, time: direct.toTimeString().slice(0, 5) };
    }

    const parts = value.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (parts) {
      const [, day, month, yearValue, hour = '00', minute = '00'] = parts;
      const year = Number(yearValue.length === 2 ? `20${yearValue}` : yearValue);
      const date = new Date(year, Number(month) - 1, Number(day), Number(hour), Number(minute));
      if (!Number.isNaN(date.getTime())) return { date, time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` };
    }

    const timeParts = value.match(/\b(\d{1,2}):(\d{2})\b/);
    if (timeParts) return { date: null, time: `${timeParts[1].padStart(2, '0')}:${timeParts[2]}` };

    return null;
  }

  private buildContentHash(sourceId: string, url: string, title: string, description: string) {
    return createHash('sha256').update(`${sourceId}|${url}|${title}|${description}`).digest('hex');
  }

  private isDuplicateKeyError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  private async notifyNewCrawlerEvent(event: Event) {
    const message = this.formatTelegramMessage(event);

    if (event.image) {
      return this.telegramService.sendPhoto(event.image, message);
    }

    return this.telegramService.sendMessage(message);
  }

  private formatTelegramMessage(event: Event) {
    const lines = [
      '<b>Su kien doi thu moi</b>',
      `<b>${this.escapeHtml(event.sourceName)}</b>`,
      '',
      this.escapeHtml(event.title),
      '',
      `Loai: ${this.escapeHtml(this.getEventTypeLabel(event.type))}`,
      event.eventDate ? `Thoi gian: ${event.eventDate.toISOString()}` : '',
      `Link: ${this.escapeHtml(event.url)}`,
    ];

    return lines.filter(Boolean).join('\n');
  }

  private getEventTypeLabel(type: string) {
    const labels: Record<string, string> = {
      release: 'Ra mat / Mo ban',
      sale: 'Khuyen mai',
      livestream: 'Livestream',
      ads: 'Quang cao',
      other: 'Khac',
    };

    return labels[type] || type;
  }

  private escapeHtml(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
