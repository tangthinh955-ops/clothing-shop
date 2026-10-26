import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import pg from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/environment.js';

@Injectable()
export class SessionResources implements OnModuleDestroy {
  private readonly pool: pg.Pool;
  readonly store: session.Store & { close: () => void };
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = new pg.Pool({ connectionString: config.databaseUrl, max: 3 });
    const PgStore = connectPgSimple(session);
    this.store = new PgStore({ pool: this.pool, tableName: 'sessions', createTableIfMissing: false, pruneSessionInterval: 900 });
  }
  async onModuleDestroy(): Promise<void> {
    this.store.close();
    await this.pool.end();
  }
}
