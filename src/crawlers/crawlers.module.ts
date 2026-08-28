import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ClassifierService } from '../classifier/classifier.service';
import { CrawlerRun } from '../crawler-runs/entity/crawler-run.entity';
import { CrawlerSource } from '../crawler-sources/entity/crawler-source.entity';
import { Event } from '../events/entity/event.entity';
import { Setting } from '../settings/entity/setting.entity';
import { TelegramService } from '../telegram/telegram.service';
import { CrawlerController } from './controller/crawler.controller';
import { CrawlerCronService } from './crawler-cron.service';
import { CrawlerService } from './service/crawler.service';

@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([Event, CrawlerRun, CrawlerSource, Setting]), AuthModule],
  controllers: [CrawlerController],
  providers: [CrawlerService, CrawlerCronService, ClassifierService, TelegramService],
  exports: [CrawlerService],
})
export class CrawlersModule {}
