import {
  requiresArtifact,
  requiresCompleteDecisionRecord,
  requiresFullClassification,
  requiresUniqueCertifiedMetrics,
} from "./exit-criteria";
import type { StageDefinition } from "./types";

/**
 * The canonical lifecycle. Stage numbers are identity — they appear in URLs,
 * gate rows and audit payloads — so they are never renumbered. Adding a stage
 * means editing this file, and only this file; stage logic must not be scattered
 * across components.
 */
export const STAGES: readonly StageDefinition[] = [
  {
    number: 0,
    title: "Workspace & Pack Setup",
    artifactKinds: [],
    requiredApprovers: ["PLATFORM_ADMIN"],
    exitCriteria: [],
  },
  {
    number: 1,
    title: "Consumption Discovery",
    artifactKinds: ["DECISION_REGISTER"],
    requiredApprovers: ["CONSUMER_REP", "PRODUCT_OWNER"],
    exitCriteria: [
      requiresArtifact("DECISION_REGISTER", "A decision register is committed"),
      requiresCompleteDecisionRecord,
    ],
  },
  {
    number: 2,
    title: "Product Charter",
    artifactKinds: ["CHARTER"],
    requiredApprovers: ["PRODUCT_OWNER", "DOMAIN_ARCHITECT"],
    exitCriteria: [requiresArtifact("CHARTER", "A charter is committed")],
  },
  {
    number: 3,
    title: "Source Discovery & Profiling",
    artifactKinds: ["SOURCE_INVENTORY"],
    requiredApprovers: ["PLATFORM_ENGINEER", "DOMAIN_SME"],
    exitCriteria: [requiresArtifact("SOURCE_INVENTORY", "A source inventory is committed")],
  },
  {
    number: 4,
    title: "Conceptual & Logical Model",
    artifactKinds: ["LOGICAL_MODEL"],
    requiredApprovers: ["DOMAIN_ARCHITECT", "DOMAIN_SME"],
    exitCriteria: [requiresArtifact("LOGICAL_MODEL", "A logical model with a stated grain is committed")],
  },
  {
    number: 5,
    title: "Attribute Register & Data Contract",
    artifactKinds: ["ATTRIBUTE_REGISTER", "DATA_CONTRACT"],
    requiredApprovers: ["DATA_STEWARD", "DOMAIN_SME", "PRODUCT_OWNER"],
    exitCriteria: [
      requiresArtifact("ATTRIBUTE_REGISTER", "An attribute register is committed"),
      requiresArtifact("DATA_CONTRACT", "A data contract is committed"),
    ],
  },
  {
    number: 6,
    title: "Semantic Model & Metrics",
    artifactKinds: ["SEMANTIC_MODEL"],
    requiredApprovers: ["DOMAIN_ARCHITECT", "PRODUCT_OWNER"],
    exitCriteria: [
      requiresArtifact("SEMANTIC_MODEL", "A semantic model is committed"),
      requiresUniqueCertifiedMetrics,
    ],
  },
  {
    number: 7,
    title: "Physical Architecture & Pipelines",
    artifactKinds: ["PHYSICAL_ARCHITECTURE"],
    requiredApprovers: ["PLATFORM_ENGINEER", "DOMAIN_ARCHITECT"],
    exitCriteria: [
      requiresArtifact("PHYSICAL_ARCHITECTURE", "A medallion mapping and lineage graph are committed"),
    ],
  },
  {
    number: 8,
    title: "Quality, Observability & Controls",
    artifactKinds: ["QUALITY_RULES"],
    requiredApprovers: ["DATA_STEWARD", "PLATFORM_ENGINEER"],
    exitCriteria: [requiresArtifact("QUALITY_RULES", "Quality rules and SLOs are committed")],
  },
  {
    number: 9,
    title: "Access, Security & Governance",
    artifactKinds: ["ACCESS_POLICY"],
    // PRIVACY_SECURITY_OFFICER holds a veto here — see VETO_ROLES.
    requiredApprovers: ["PRIVACY_SECURITY_OFFICER", "DATA_STEWARD"],
    exitCriteria: [
      requiresArtifact("ACCESS_POLICY", "An access policy is committed"),
      requiresFullClassification,
    ],
  },
  {
    number: 10,
    title: "Serving & Consumption Interfaces",
    artifactKinds: ["MARKETPLACE_LISTING", "GROUNDING_PACK"],
    requiredApprovers: ["CONSUMER_REP", "DOMAIN_ARCHITECT"],
    exitCriteria: [
      requiresArtifact("MARKETPLACE_LISTING", "A marketplace listing is committed"),
      requiresArtifact("GROUNDING_PACK", "A grounding pack is committed"),
    ],
  },
  {
    number: 11,
    title: "Certification & Publication",
    artifactKinds: ["CERTIFICATION_SCORECARD"],
    requiredApprovers: ["PRODUCT_OWNER", "DATA_STEWARD", "DOMAIN_ARCHITECT"],
    exitCriteria: [
      requiresArtifact("CERTIFICATION_SCORECARD", "A DATSIS+V scorecard with cited evidence is committed"),
    ],
  },
  {
    number: 12,
    title: "Operate & Evolve",
    artifactKinds: ["OPERATIONS_LOG"],
    requiredApprovers: ["PRODUCT_OWNER"],
    exitCriteria: [],
  },
] as const;

export const FIRST_STAGE = 0;
export const LAST_STAGE = STAGES.length - 1;

export function getStage(stageNumber: number): StageDefinition {
  const stage = STAGES.find((s) => s.number === stageNumber);
  if (!stage) {
    throw new Error(
      `Unknown stage ${stageNumber}. Valid stages are ${FIRST_STAGE}–${LAST_STAGE}.`,
    );
  }
  return stage;
}
