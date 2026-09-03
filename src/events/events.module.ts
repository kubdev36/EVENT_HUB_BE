import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Event } from './entity/event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Setting } from '../settings/entity/setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Setting]), AuthModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
