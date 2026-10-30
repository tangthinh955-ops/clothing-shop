export function assertTestDatabase(databaseUrl: string | undefined, nodeEnv?: string): void;
export function testDatabaseName(label: string): string;
export function createIsolatedTestDatabase(databaseUrl: string | undefined, label: string): Promise<{
  databaseUrl: string;
  name: string;
  cleanup(): Promise<void>;
}>;
