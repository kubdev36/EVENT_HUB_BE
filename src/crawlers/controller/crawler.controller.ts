import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { CrawlerService } from '../service/crawler.service';

@ApiTags('crawlers')
@ApiBearerAuth()
@Controller('crawlers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrawlerController {
  constructor(private readonly crawlerService: CrawlerService) {}

  @Get('run')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Run all enabled crawler targets' })
  async runAll() {
    return this.crawlerService.crawlAllTargets();
  }

  @Post('run')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Run all enabled crawler targets' })
  async runAllPost() {
    return this.crawlerService.crawlAllTargets();
  }

  @Post('run/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Run one crawler target by id' })
  @ApiParam({ name: 'id', type: String })
  async runOne(@Param('id') id: string) {
    return this.crawlerService.crawlTargetById(id);
  }
}
