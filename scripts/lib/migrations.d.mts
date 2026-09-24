export function wrapMigration(sql: string, fileName: string): string;
export function assertSafeToApply(opts: { baseline: boolean; recordedCount: number; existingTableCount: number }): void;
