import { z } from "zod";

/**
 * The authoritative value sets for every String-typed enum column in
 * prisma/schema.prisma. Prisma cannot express enums on SQLite, so validation
 * lives here and every write path runs through it.
 */

export const Role = z.enum([
  "PLATFORM_ADMIN",
  "PRODUCT_OWNER",
  "DOMAIN_ARCHITECT",
  "DOMAIN_SME",
  "PLATFORM_ENGINEER",
  "DATA_STEWARD",
  "PRIVACY_SECURITY_OFFICER",
  "CONSUMER_REP",
]);
export type Role = z.infer<typeof Role>;

/**
 * Roles that can single-handedly block a gate. A rejection from a veto role
 * blocks approval regardless of how many other approvers signed off.
 */
export const VETO_ROLES: readonly Role[] = ["PRIVACY_SECURITY_OFFICER"];

export const GateStatus = z.enum([
  "NOT_STARTED",
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "STALE",
]);
export type GateStatus = z.infer<typeof GateStatus>;

export const ApprovalDecision = z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]);
export type ApprovalDecision = z.infer<typeof ApprovalDecision>;

/**
 * Provenance of an artifact version. AI output is always written as AI_DRAFT and
 * can only be promoted by an explicit human edit or acceptance.
 */
export const Provenance = z.enum(["AI_DRAFT", "HUMAN_AUTHORED", "HUMAN_REVIEWED"]);
export type Provenance = z.infer<typeof Provenance>;

export const HUMAN_PROVENANCE: readonly Provenance[] = ["HUMAN_AUTHORED", "HUMAN_REVIEWED"];

export const Sensitivity = z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]);
export type Sensitivity = z.infer<typeof Sensitivity>;

export const ArtifactKind = z.enum([
  "DECISION_REGISTER",
  "CHARTER",
  "SOURCE_INVENTORY",
  "LOGICAL_MODEL",
  "ATTRIBUTE_REGISTER",
  "DATA_CONTRACT",
  "SEMANTIC_MODEL",
  "PHYSICAL_ARCHITECTURE",
  "QUALITY_RULES",
  "ACCESS_POLICY",
  "MARKETPLACE_LISTING",
  "GROUNDING_PACK",
  "CERTIFICATION_SCORECARD",
  "OPERATIONS_LOG",
]);
export type ArtifactKind = z.infer<typeof ArtifactKind>;

export const AuditEventType = z.enum([
  "ARTIFACT_VERSION_COMMITTED",
  "GATE_STATUS_CHANGED",
  "APPROVAL_RECORDED",
  "CASCADE_INVALIDATED",
  "PRODUCT_CREATED",
  "WORKSPACE_CREATED",
  "ROLE_ASSIGNED",
]);
export type AuditEventType = z.infer<typeof AuditEventType>;
