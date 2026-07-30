/**
 * Typed governance failures. Every one of these is a condition a reviewer can
 * act on, so each carries a message that says what to do next rather than what
 * went wrong internally. No governance failure is ever swallowed.
 */
export class GovernanceError extends Error {
  constructor(
    message: string,
    readonly code: GovernanceErrorCode,
  ) {
    super(message);
    this.name = "GovernanceError";
  }
}

export type GovernanceErrorCode =
  | "NOT_AUTHORIZED"
  | "ROLE_NOT_HELD"
  | "STAGE_LOCKED"
  | "EXIT_CRITERIA_UNMET"
  | "QUORUM_NOT_MET"
  | "VETOED"
  | "AI_CANNOT_APPROVE"
  | "IMMUTABLE_VERSION";

export function notAuthorized(detail: string): GovernanceError {
  return new GovernanceError(detail, "NOT_AUTHORIZED");
}

export function roleNotHeld(role: string, workspaceSlug: string): GovernanceError {
  return new GovernanceError(
    `You do not hold the ${role} role in workspace "${workspaceSlug}". Ask a platform admin to assign it, or have someone who holds it review instead.`,
    "ROLE_NOT_HELD",
  );
}

export function stageLocked(stageNumber: number, blockingStage: number): GovernanceError {
  return new GovernanceError(
    `Stage ${stageNumber} is locked because stage ${blockingStage} is not approved. Close stage ${blockingStage} first.`,
    "STAGE_LOCKED",
  );
}

export function exitCriteriaUnmet(stageNumber: number, failures: string[]): GovernanceError {
  return new GovernanceError(
    `Stage ${stageNumber} cannot enter review until these are resolved: ${failures.join("; ")}`,
    "EXIT_CRITERIA_UNMET",
  );
}
