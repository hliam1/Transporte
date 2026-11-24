import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Pool } from 'pg';
import { Public } from '../../common/auth/decorators';
import { PG_POOL } from '../../database/database.module';

@ApiTags('Sistema')
@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Estado del servicio y de la base de datos' })
  async check(): Promise<{ status: 'ok'; database: 'ok' }> {
    try {
      await this.pool.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Base de datos no disponible');
    }
    return { status: 'ok', database: 'ok' };
  }
}
