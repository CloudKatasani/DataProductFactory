/**
 * `pnpm pack:validate` — validates every pack under packs/ against the pack
 * schema. Exits non-zero on any failure so it can gate CI.
 */
import { loadAllPacks, PackValidationError } from "../src/lib/packs/loader";

async function main(): Promise<void> {
  try {
    const packs = await loadAllPacks();
    if (packs.length === 0) {
      console.error("No packs found under packs/. At least _generic must exist.");
      process.exit(1);
    }
    for (const pack of packs) {
      console.log(
        `ok  ${pack.id.padEnd(16)} v${pack.version}  ` +
          `${pack.domains.length} domain(s), ` +
          `${pack.conformedBackbone.length} backbone entity(ies), ` +
          `${pack.regulatoryConstraints.length} constraint(s), ` +
          `${pack.starterMetrics.length} starter metric(s)`,
      );
    }
    console.log(`\n${packs.length} pack(s) valid.`);
  } catch (error) {
    if (error instanceof PackValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

void main();
