import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CrawlersModule } from '../crawlers/crawlers.module';
import { SettingsController } from './controller/settings.controller';
import { Setting } from './entity/setting.entity';
import { SettingsService } from './service/settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Setting]), AuthModule, CrawlersModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
