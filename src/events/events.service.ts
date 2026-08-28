import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventDto } from './dto/create-event.dto';
import { Event } from './entity/event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
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
    const event = this.eventRepository.create({
      sourceId: 'manual',
      sourceName: 'Manual',
      origin: 'manual',
      sourceUrl: data.url || '',
      title: data.title,
      description: data.description ?? null,
      image: data.image ?? null,
      url: data.url || '',
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      eventTime: data.eventTime ?? null,
      type: data.type,
      rawData: { origin: 'manual' },
      contentHash: `manual|${data.title}|${data.url || ''}`,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      notifiedAt: null,
    });

    return this.eventRepository.save(event);
  }
}
