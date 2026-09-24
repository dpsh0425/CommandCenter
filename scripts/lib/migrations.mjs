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

// Reads --baseline, --production and --force; rejects any other --option so typos are not ignored.
export function parseArgs(argv) {
  const out = { baseline: false, production: false, force: false };
  for (const arg of argv) {
    if (arg === "--baseline") out.baseline = true;
    else if (arg === "--production") out.production = true;
    else if (arg === "--force") out.force = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
  }
  return out;
}

// Refuses to touch the production project unless --production was given.
export function assertTargetAllowed({ ref, productionRef, production }) {
  if (ref === productionRef && !production) {
    throw new Error(`Refusing to run against the production project (${ref}) without --production.`);
  }
}

// --baseline records every unrecorded file as applied, so refuse it on a project that already has records unless forced.
export function assertBaselineAllowed({ baseline, recordedCount, force }) {
  if (baseline && recordedCount > 0 && !force) {
    throw new Error("Some migrations are already recorded on this project. --baseline would also mark any newer, unapplied migrations as applied. Add --force only if you are sure every unrecorded file was applied by hand.");
  }
}
