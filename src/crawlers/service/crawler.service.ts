import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { createHash } from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { Repository } from 'typeorm';
import { ClassifierService } from '../../classifier/classifier.service.js';
import { CrawlerRun } from '../../crawler-runs/entity/crawler-run.entity.js';
import { Event } from '../../events/entity/event.entity.js';
import { Setting } from '../../settings/entity/setting.entity.js';
import { TelegramService } from '../../telegram/telegram.service.js';
import { CrawlSource, CrawlTarget, KeywordRule, ParsedCrawlItem } from '../crawler.types.js';

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
    if (!setting?.value) return [];
    if (Array.isArray(setting.value)) return setting.value as CrawlTarget[];
    if (typeof setting.value === 'object') {
      const obj = setting.value as { targets?: CrawlTarget[]; sources?: CrawlTarget[] };
      if (Array.isArray(obj.targets)) return obj.targets;
      if (Array.isArray(obj.sources)) return obj.sources;
    }
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

    for (const baseUrl of target.targetUrls || []) {
      const urlsToCrawl = [baseUrl];

      // Auto add pagination pages (1 to 8) for "Xem thêm" / Load More deep crawling
      if (baseUrl.includes('category') || baseUrl.includes('tin-tuc') || baseUrl.includes('khuyen-mai')) {
        for (let p = 2; p <= 8; p++) {
          const pPage = baseUrl.includes('?') ? `${baseUrl}&page=${p}` : (baseUrl.endsWith('/') ? `${baseUrl}page/${p}/` : `${baseUrl}/page/${p}/`);
          const pTrang = baseUrl.endsWith('/') ? `${baseUrl}trang-${p}` : `${baseUrl}/trang-${p}`;
          urlsToCrawl.push(pPage, pTrang);
        }
      }

      for (const currentUrl of urlsToCrawl) {
        const response = await this.fetchHtml(currentUrl);
        if (!response) continue;

        const $ = cheerio.load(response.html);
        items.push(...this.extractFromMetadata($, response.url));
        items.push(...(await this.extractFromEventBlocks($, response.url)));
        items.push(...(await this.extractFromLinks($, response.url)));
        items.push(...this.extractCellphonesNextPayload(response.html, response.url));
        items.push(...this.extractFptNextPayload(response.html, response.url));

        if (response.html.includes('<rss') || response.html.includes('<feed') || response.html.includes('<?xml')) {
          const $rss = cheerio.load(response.html, { xmlMode: true });
          items.push(...this.extractFromRss($rss, response.url));
        }

        // Auto fetch category RSS feed if available
        if (!currentUrl.includes('/feed')) {
          const feedUrl = currentUrl.endsWith('/') ? `${currentUrl}feed/` : `${currentUrl}/feed/`;
          const feedResp = await this.fetchHtml(feedUrl);
          if (feedResp && (feedResp.html.includes('<rss') || feedResp.html.includes('<feed') || feedResp.html.includes('<?xml'))) {
            const $rss = cheerio.load(feedResp.html, { xmlMode: true });
            items.push(...this.extractFromRss($rss, feedResp.url));
          }
        }
      }
    }

    // TGDD AJAX deep crawling: POST /tin-tuc/aj/Home/Box with {ID, Size, Index}
    if (target.id === 'tgdd') {
      items.push(...(await this.fetchTgddAjaxPages()));
    }

    // FPT Shop: extract all article URLs from script payloads across all target URLs
    if (target.id === 'fptshop') {
      items.push(...(await this.fetchFptServerActionPages(target)));
    }

    return await this.dedupeAndRankItems(items, target);
  }

  private async fetchTgddAjaxPages(): Promise<ParsedCrawlItem[]> {
    const items: ParsedCrawlItem[] = [];
    const seen = new Set<string>();

    for (let idx = 0; idx <= 15; idx++) {
      const response = await this.postAjax(
        'https://www.thegioididong.com/tin-tuc/aj/Home/Box',
        `ID=1169&Size=10&Index=${idx}`,
        'https://www.thegioididong.com/tin-tuc',
      );
      if (!response || response.length < 100) break;

      const $ = cheerio.load(response);
      $('li[data-id]').each((_, el) => {
        const li = $(el);
        const link = li.find('a[href*="/tin-tuc/"]').first();
        const href = link.attr('href');
        const title = link.text().replace(/\s+/g, ' ').trim();
        const img = li.find('img').attr('data-original') || li.find('img').attr('data-src') || li.find('img').attr('data-lazy-src') || null;

        if (href && title.length > 10) {
          const fullUrl = href.startsWith('http') ? href : `https://www.thegioididong.com${href}`;
          if (!seen.has(fullUrl)) {
            seen.add(fullUrl);
            items.push({
              title,
              description: null,
              image: img && !img.startsWith('data:') ? (img.startsWith('http') ? img : `https://www.thegioididong.com${img}`) : null,
              url: fullUrl,
              eventDate: new Date(),
              score: 4,
              rawData: { kind: 'tgdd-ajax', page: idx },
            });
          }
        }
      });
    }

    return items;
  }

  private async fetchFptServerActionPages(target: CrawlTarget): Promise<ParsedCrawlItem[]> {
    const items: ParsedCrawlItem[] = [];
    const seen = new Set<string>();

    for (const baseUrl of target.targetUrls || []) {
      const response = await this.fetchHtml(baseUrl);
      if (!response) continue;

      // Extract all article URLs from the page HTML and script payloads
      const unescaped = response.html.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\u0026/g, '&');
      const hrefMatches = unescaped.match(/https:\/\/fptshop\.com\.vn\/tin-tuc\/(?:tin-khuyen-mai|tin-moi|danh-gia|dien-may|tin-fstudio)\/[a-z0-9-]+/g) || [];

      hrefMatches.forEach((rawHref) => {
        const cleanUrl = rawHref.split('?')[0].replace(/\/$/, '');
        if (!seen.has(cleanUrl)) {
          seen.add(cleanUrl);
          const slug = cleanUrl.split('/').pop() || '';
          const title = slug.replace(/-/g, ' ').replace(/\d+$/, '').trim();
          if (title.length > 8) {
            items.push({
              title,
              description: null,
              image: null,
              url: cleanUrl,
              eventDate: new Date(),
              score: 3,
              rawData: { kind: 'fpt-server-action', sourceUrl: baseUrl },
            });
          }
        }
      });

      // Also extract from visible <a> tags
      const $ = cheerio.load(response.html);
      $('a[href*="/tin-tuc/"]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (href && text.length > 10 && !href.endsWith('/tin-tuc/') && !href.includes('/tac-gia/')) {
          const fullUrl = href.startsWith('http') ? href : `https://fptshop.com.vn${href}`;
          const cleanUrl = fullUrl.split('?')[0].replace(/\/$/, '');
          if (!seen.has(cleanUrl)) {
            seen.add(cleanUrl);
            items.push({
              title: text.slice(0, 200),
              description: null,
              image: null,
              url: cleanUrl,
              eventDate: new Date(),
              score: 3,
              rawData: { kind: 'fpt-link', sourceUrl: baseUrl },
            });
          }
        }
      });
    }

    return items;
  }

  private postAjax(url: string, body: string, referer: string): Promise<string | null> {
    return new Promise((resolve) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'content-length': Buffer.byteLength(body).toString(),
          'x-requested-with': 'XMLHttpRequest',
          referer,
        },
      };

      const request = client.request(options, (response) => {
        let data = '';
        response.on('data', (chunk: Buffer | string) => { data += chunk; });
        response.on('end', () => resolve(data));
      });

      request.setTimeout(15000, () => { request.destroy(); resolve(null); });
      request.on('error', () => resolve(null));
      request.write(body);
      request.end();
    });
  }

  private async fetchHtml(url: string) {
    const attempts = [url];
    if (url.startsWith('https://')) {
      attempts.push(url.replace('https://', 'http://'));
    }

    for (const attemptUrl of attempts) {
      for (let retry = 0; retry < 3; retry += 1) {
        try {
          return await this.requestHtml(attemptUrl, 0);
        } catch {
          if (retry === 2) continue;
        }
      }
    }

    return null;
  }

  private async requestHtml(url: string, redirectCount = 0): Promise<{ url: string; html: string } | null> {
    if (redirectCount > 5) return null;

    return new Promise((resolve, reject) => {
      const client = url.startsWith('https://') ? https : http;
      const request = client.get(
        url,
        {
          headers: {
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'cache-control': 'no-cache',
            pragma: 'no-cache',
            'upgrade-insecure-requests': '1',
          },
        },
        (response) => {
          const statusCode = response.statusCode || 0;
          const location = response.headers.location;

          if (statusCode >= 300 && statusCode < 400 && location) {
            const nextUrl = new URL(location, url).toString();
            response.resume();
            this.requestHtml(nextUrl, redirectCount + 1).then(resolve).catch(reject);
            return;
          }

          if (statusCode < 200 || statusCode >= 400) {
            response.resume();
            resolve(null);
            return;
          }

          response.setEncoding('utf8');
          let html = '';
          response.on('data', (chunk) => {
            html += chunk;
          });
          response.on('end', () => resolve({ url, html }));
        },
      );

      request.setTimeout(15000, () => {
        request.destroy(new Error('Request timeout'));
      });
      request.on('error', reject);
    });
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
        eventDate: published?.date ?? new Date(),
        eventTime: published?.time ?? null,
        score: 2,
        rawData: { kind: 'metadata', sourceUrl },
      },
    ];
  }

  private extractFromRss($: cheerio.CheerioAPI, sourceUrl: string): ParsedCrawlItem[] {
    const items: ParsedCrawlItem[] = [];
    const elements = $('item, entry').toArray();

    for (const el of elements) {
      const item = $(el);
      const title = item.find('title').first().text().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      const url = item.find('link').first().text().trim() || item.find('link').first().attr('href') || sourceUrl;
      const normalizedTitle = this.normalizeText(title);

      // Skip non-event tech tips articles (like "Cách...", "Lỗi...", "Hướng dẫn...")
      if (
        /^(cach|huong dan|loi|meo|review|tren tay|danh gia|top \d+)/i.test(normalizedTitle) &&
        !normalizedTitle.includes('khuyen mai') &&
        !normalizedTitle.includes('sale') &&
        !normalizedTitle.includes('uu dai')
      ) {
        continue;
      }

      const rawContent = item.find('content\\:encoded').text() || item.find('description').text() || '';
      const $c = cheerio.load(rawContent);
      let image = $c('img').first().attr('src') || item.find('enclosure').attr('url') || item.find('media\\:content').attr('url') || null;

      if (image && (this.isNoiseImage(image) || image.startsWith('data:'))) {
        image = null;
      }

      const absoluteUrl = this.resolveUrl(sourceUrl, url);
      const description = $c.text().replace(/\s+/g, ' ').trim();
      const pubDate = item.find('pubDate, published, updated').first().text().trim();

      if (title.length > 8 && absoluteUrl) {
        const published = this.parsePublishedDate(pubDate);
        items.push({
          title,
          description: description ? description.slice(0, 300) : null,
          image: image ? this.resolveUrl(sourceUrl, image) : null,
          url: absoluteUrl,
          eventDate: published?.date ?? new Date(),
          eventTime: published?.time ?? null,
          score: 4,
          rawData: { kind: 'rss-feed', sourceUrl },
        });
      }
    }
    return items;
  }

  private extractCellphonesNextPayload(html: string, sourceUrl: string): ParsedCrawlItem[] {
    const items: ParsedCrawlItem[] = [];
    const pushMatches = html.match(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g) || [];

    pushMatches.forEach((pm) => {
      const raw = pm.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const promoObjs = raw.match(/\{[^{}]*?"(?:alt|title)":\s*"([^"]+)"[^{}]*?\}/g) || [];

      promoObjs.forEach((objText) => {
        const altMatch = objText.match(/"(?:alt|title)":\s*"([^"]+)"/);
        const linkMatch = objText.match(/"(?:href|link|url)":\s*"([^"]+)"/);
        const imgMatch = objText.match(/"(?:src|desktop|mobile|image|banner)":\s*"([^"]+)"/);

        if (altMatch) {
          const title = altMatch[1].trim();
          const href = linkMatch ? linkMatch[1] : sourceUrl;
          const img = imgMatch ? imgMatch[1] : null;

          if (
            title.length > 5 &&
            !title.includes('logo') &&
            !title.includes('social') &&
            !title.includes('QR') &&
            !title.includes('Hà Nội') &&
            !title.includes('An Giang') &&
            !title.includes('Bình Dương') &&
            !title.includes('Cần Thơ') &&
            !title.includes('Next') &&
            !title.includes('DMCA') &&
            !title.includes('1800') &&
            !title.includes('Chính sách')
          ) {
            const url = href.startsWith('http') ? href : this.resolveUrl(sourceUrl, href);
            items.push({
              title,
              description: `Chương trình ${title} tại CellphoneS`,
              image: img ? this.resolveUrl(sourceUrl, img) : null,
              url,
              score: 4,
              rawData: { kind: 'cellphones-payload', sourceUrl },
            });
          }
        }
      });
    });

    return items;
  }

  private extractFptNextPayload(html: string, sourceUrl: string): ParsedCrawlItem[] {
    const items: ParsedCrawlItem[] = [];
    const seen = new Set<string>();

    const unescaped = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\u0026/g, '&');
    const hrefMatches = unescaped.match(/https:\/\/fptshop\.com\.vn\/tin-tuc\/(?:tin-khuyen-mai|tin-moi)\/[a-z0-9-]+/g) || [];

    hrefMatches.forEach((rawHref) => {
      const cleanUrl = rawHref.split('?')[0].replace(/\/$/, '');
      if (!seen.has(cleanUrl)) {
        seen.add(cleanUrl);

        const idx = unescaped.indexOf(rawHref);
        const snippet = unescaped.slice(Math.max(0, idx - 300), idx + 300);
        const titleMatch = snippet.match(/"(?:title|name|alt|label|heading)":\s*"([^"]+)"/) || snippet.match(/"([^"]{10,120})"/);
        const imgMatch = snippet.match(/"(?:src|image|avatar|thumbnail)":\s*"(https:\/\/cdn2\.fptshop\.com\.vn\/[^"]+)"/);

        const fallbackTitle = cleanUrl.split('/').pop()?.replace(/-/g, ' ') || 'Chương trình FPT Shop';
        const title = titleMatch ? titleMatch[1].replace(/\\u0026/g, '&') : fallbackTitle;
        const img = imgMatch ? imgMatch[1] : null;

        if (title.length > 8 && !title.includes('FPT Shop') && !title.includes('tac-gia')) {
          items.push({
            title: title.trim(),
            description: `Chương trình ${title} tại FPT Shop`,
            image: img ? this.resolveUrl(sourceUrl, img) : null,
            url: cleanUrl,
            eventDate: new Date(),
            score: 4,
            rawData: { kind: 'fpt-payload', sourceUrl },
          });
        }
      }
    });

    return items;
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
      '[class*="item"]',
      '[class*="card"]',
      '[class*="cps"]',
      '[class*="box"]',
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
      const image = await this.findBestImage($, block, sourceUrl);
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
        eventDate: published?.date ?? new Date(),
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
      const image = await this.findBestImage($, context.length ? context : link, sourceUrl);
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
        eventDate: published?.date ?? new Date(),
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
    const now = new Date();
    const currentCrawlTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const eventTime = item.eventTime || currentCrawlTime;

    const payload = this.eventRepository.create({
      sourceId: target.id,
      sourceName: target.name,
      origin: 'crawler',
      sourceUrl: (item.rawData?.sourceUrl as string) || item.url,
      title: item.title,
      description: item.description ?? null,
      image: item.image ?? null,
      url: item.url,
      eventDate: now,
      eventTime,
      type,
      rawData: item.rawData ?? null,
      contentHash: this.buildContentHash(target.id, item.url, item.title, item.description || ''),
      firstSeenAt: now,
      lastSeenAt: now,
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
          existing.lastSeenAt = now;
          existing.eventDate = now;
          existing.title = item.title;
          existing.description = item.description ?? existing.description;
          existing.image = item.image ?? existing.image;
          existing.eventTime = existing.eventTime || eventTime;
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

  private async dedupeAndRankItems(items: ParsedCrawlItem[], target?: CrawlTarget) {
    const map = new Map<string, ParsedCrawlItem>();

    const targetDomains = (target?.targetUrls || [])
      .map((u) => {
        try {
          return new URL(u).hostname.replace('www.', '');
        } catch {
          return '';
        }
      })
      .filter(Boolean);

    for (const item of items) {
      if (!item.title || !item.url) continue;

      if (targetDomains.length > 0) {
        try {
          const itemHost = new URL(item.url).hostname.replace('www.', '');
          const isMatch = targetDomains.some((dom) => itemHost.includes(dom) || dom.includes(itemHost));
          if (!isMatch) continue;
        } catch {
          continue;
        }
      }

      const cleanUrl = item.url.split('?')[0].replace(/\/$/, '');
      const key = `${cleanUrl}|${this.normalizeText(item.title)}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, { ...item });
      } else {
        if ((!existing.image || existing.image.startsWith('data:')) && item.image && !item.image.startsWith('data:')) {
          existing.image = item.image;
        }
        if ((item.score || 0) > (existing.score || 0)) {
          existing.score = item.score;
        }
      }
    }

    const list = Array.from(map.values());

    // Auto fetch missing images for items using batched parallel OpenGraph lookup
    const missingImageItems = list.filter((i) => !i.image || i.image.startsWith('data:')).slice(0, 100);
    const batchSize = 10;
    for (let i = 0; i < missingImageItems.length; i += batchSize) {
      const batch = missingImageItems.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          const ogImage = await this.fetchDetailImage(item.url, item.url);
          if (ogImage) {
            item.image = ogImage;
          }
        })
      );
    }

    return list
      .sort((a, b) => {
        const imgA = a.image && !a.image.startsWith('data:') ? 1 : 0;
        const imgB = b.image && !b.image.startsWith('data:') ? 1 : 0;
        if (imgB !== imgA) return imgB - imgA;
        return (b.score || 0) - (a.score || 0);
      })
      .slice(0, 300);
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

    return /khuyen-mai|uu-dai|sale|livestream|ra-mat|mo-ban|su-kien|promotion|event|launch|campaign|flash-sale|giam-gia|hot-deal|voucher|thanh-toan|smember|sforum|tin-tuc|deal|giam|tang|quoc-khanh|flagship|chuong-trinh|mo-rong|tra-gop/.test(value);
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
      combined.includes('gioi thieu ve cong ty') ||
      combined.includes('gioi thieu cong ty') ||
      combined.includes('quy che') ||
      combined.includes('cau hoi thuong gap') ||
      combined.includes('tra cuu') ||
      combined.includes('quy trinh') ||
      combined.includes('cac dieu kien') ||
      combined.includes('du an doanh nghiep') ||
      combined.includes('huong dan mua hang') ||
      combined.includes('dai ly uy quyen') ||
      combined.includes('nguoi co anh huong') ||
      combined.includes('quy dinh ve') ||
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
      value.includes('video')
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

    // Vietnamese relative time patterns: "2 giờ trước", "1 ngày trước", "3 ngày trước"
    const relativeMatch = value.match(/(\d+)\s*(phút|giờ|ngày|tuần)\s*(trước|sau)/i);
    if (relativeMatch) {
      const [, count, unit, direction] = relativeMatch;
      const n = Number(count);
      const now = new Date();
      const date = new Date(now.getTime());
      if (direction === 'trước') {
        if (unit.toLowerCase().includes('phút')) date.setMinutes(date.getMinutes() - n);
        else if (unit.toLowerCase().includes('giờ')) date.setHours(date.getHours() - n);
        else if (unit.toLowerCase().includes('ngày')) date.setDate(date.getDate() - n);
        else if (unit.toLowerCase().includes('tuần')) date.setDate(date.getDate() - n * 7);
      } else {
        if (unit.toLowerCase().includes('phút')) date.setMinutes(date.getMinutes() + n);
        else if (unit.toLowerCase().includes('giờ')) date.setHours(date.getHours() + n);
        else if (unit.toLowerCase().includes('ngày')) date.setDate(date.getDate() + n);
        else if (unit.toLowerCase().includes('tuần')) date.setDate(date.getDate() + n * 7);
      }
      return { date, time: date.toTimeString().slice(0, 5) };
    }

    // Time range patterns: "8:00 - 21:30", "8h - 21h30", "8:00-21:30"
    const rangeMatch = value.match(/(\d{1,2})[:hH](\d{2})?\s*[-–—]\s*(\d{1,2})[:hH](\d{2})?/);
    if (rangeMatch) {
      const [, hour1, minute1 = '00', hour2, minute2 = '00'] = rangeMatch;
      const time1 = `${hour1.padStart(2, '0')}:${minute1}`;
      const time2 = `${hour2.padStart(2, '0')}:${minute2}`;
      return { date: null, time: time1, endTime: time2 };
    }

    const timeParts = value.match(/\b(\d{1,2}):(\d{2})\b/);
    if (timeParts) {
      const hour = Number(timeParts[1]);
      if (hour >= 0 && hour <= 23) {
        return { date: null, time: `${timeParts[1].padStart(2, '0')}:${timeParts[2]}` };
      }
    }

    // Vietnamese hour format: "8h", "8h30", "21h00", "9 giờ 30 phút"
    const vnTimeMatch = value.match(/(\d{1,2})\s*(?:h|giờ)\s*(\d{1,2})?\s*(?:phút)?/i);
    if (vnTimeMatch) {
      const hour = Number(vnTimeMatch[1]);
      if (hour >= 0 && hour <= 23) {
        const minute = vnTimeMatch[2] || '00';
        return { date: null, time: `${String(hour).padStart(2, '0')}:${minute.padStart(2, '0')}` };
      }
    }

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
