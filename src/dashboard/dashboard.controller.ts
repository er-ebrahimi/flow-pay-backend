import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardDto } from './dto/dashboard.dto.js';

@ApiTags('dashboard')
@ApiBearerAuth('jwt')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<DashboardDto> {
    return this.dashboardService.get(user.id);
  }
}
