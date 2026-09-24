export function wrapMigration(sql: string, fileName: string): string;
export function assertSafeToApply(opts: { baseline: boolean; recordedCount: number; existingTableCount: number }): void;
export function parseArgs(argv: string[]): { baseline: boolean; production: boolean; force: boolean };
export function assertTargetAllowed(opts: { ref: string; productionRef: string; production: boolean }): void;
export function assertBaselineAllowed(opts: { baseline: boolean; recordedCount: number; force: boolean }): void;
