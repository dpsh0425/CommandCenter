// Pure helpers for scripts/apply-migrations.mjs.

// Wraps a migration and its bookkeeping insert in one explicit transaction.
export function wrapMigration(sql, fileName) {
  const name = fileName.replace(/'/g, "''");
  return `begin;\n${sql}\n;\ninsert into public._applied_migrations (name) values ('${name}');\ncommit;`;
}

// Refuses plain mode on a project that has tables but no migration records.
export function assertSafeToApply({ baseline, recordedCount, existingTableCount }) {
  if (!baseline && recordedCount === 0 && existingTableCount > 0) {
    throw new Error("This project already has tables but no migration records. If its migrations were applied by hand, run with --baseline first.");
  }
}
