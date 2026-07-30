import { VETO_ROLES, type ApprovalDecision, type Role } from "@/lib/artifacts/enums";

export interface ApprovalRecord {
  role: Role;
  decision: ApprovalDecision;
  /** Hash of the artifact version the approver actually saw. */
  artifactHash: string;
  createdAt: Date;
}

export interface QuorumResult {
  satisfied: boolean;
  /** Required roles with no standing APPROVE. */
  missingRoles: Role[];
  /** Veto roles that rejected. Non-empty means blocked regardless of quorum. */
  vetoedBy: Role[];
  /** Approvals cast against an artifact version that has since been superseded. */
  staleRoles: Role[];
}

/**
 * Pure quorum evaluation. Every required role must have a standing APPROVE
 * against the *current* artifact hash; any veto-role rejection blocks outright.
 *
 * "Standing" means most-recent-wins: a role that approved and later requested
 * changes has withdrawn its approval.
 */
export function evaluateQuorum(
  requiredApprovers: readonly Role[],
  approvals: readonly ApprovalRecord[],
  currentArtifactHash: string,
): QuorumResult {
  const latestByRole = new Map<Role, ApprovalRecord>();
  for (const a of approvals) {
    const existing = latestByRole.get(a.role);
    if (!existing || a.createdAt.getTime() >= existing.createdAt.getTime()) {
      latestByRole.set(a.role, a);
    }
  }

  const vetoedBy: Role[] = [];
  for (const role of VETO_ROLES) {
    const latest = latestByRole.get(role);
    if (latest && latest.decision === "REJECT") {
      vetoedBy.push(role);
    }
  }

  const missingRoles: Role[] = [];
  const staleRoles: Role[] = [];
  for (const role of requiredApprovers) {
    const latest = latestByRole.get(role);
    if (!latest || latest.decision !== "APPROVE") {
      missingRoles.push(role);
      continue;
    }
    // Approving one version does not approve the next one.
    if (latest.artifactHash !== currentArtifactHash) {
      staleRoles.push(role);
      missingRoles.push(role);
    }
  }

  return {
    satisfied: vetoedBy.length === 0 && missingRoles.length === 0,
    missingRoles,
    vetoedBy,
    staleRoles,
  };
}
