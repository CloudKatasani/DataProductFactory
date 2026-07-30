import type { Prisma } from "@prisma/client";
import type { AttributeRecord } from "./schemas/attribute-register";

/**
 * Project a committed attribute register into the Attribute table, which is what
 * the Stage 9 classification criterion (Non-Negotiable 10) counts. The register
 * artifact is the reviewable document; these rows are the queryable state, and
 * this is the one place that keeps them in step.
 *
 * The register is the source of truth: attributes it lists are upserted (and
 * un-archived if they had been removed before), and any active attribute it no
 * longer lists is archived — never hard-deleted (Non-Negotiable 4).
 */
export async function syncAttributes(
  tx: Prisma.TransactionClient,
  productId: string,
  attributes: AttributeRecord[],
): Promise<void> {
  const names = attributes.map((a) => a.name);

  await tx.attribute.updateMany({
    where: { productId, archivedAt: null, name: { notIn: names } },
    data: { archivedAt: new Date() },
  });

  for (const a of attributes) {
    await tx.attribute.upsert({
      where: { productId_name: { productId, name: a.name } },
      create: {
        productId,
        name: a.name,
        dataType: a.dataType,
        sensitivity: a.sensitivity,
        piiFlag: a.piiFlag,
        regulatoryFlags: a.regulatoryFlags,
      },
      update: {
        dataType: a.dataType,
        sensitivity: a.sensitivity,
        piiFlag: a.piiFlag,
        regulatoryFlags: a.regulatoryFlags,
        archivedAt: null,
      },
    });
  }
}
