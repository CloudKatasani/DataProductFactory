import type { Prisma } from "@prisma/client";
import type { AuditEventType } from "@/lib/artifacts/enums";

export interface AuditInput {
  workspaceId: string;
  productId?: string;
  actorId?: string;
  type: AuditEventType;
  payload: Record<string, unknown>;
}

/**
 * The only way to write an AuditEvent. Insert-only by construction: this module
 * exposes no update and no delete, and callers pass a transaction client so the
 * event lands in the same transaction as the thing it records — an audit entry
 * that can be rolled back independently of its cause is worse than none.
 */
export async function recordAudit(
  tx: Prisma.TransactionClient,
  input: AuditInput,
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      productId: input.productId ?? null,
      actorId: input.actorId ?? null,
      type: input.type,
      payloadJson: JSON.stringify(input.payload),
    },
  });
}
