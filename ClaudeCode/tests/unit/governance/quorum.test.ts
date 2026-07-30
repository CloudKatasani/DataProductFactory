import { describe, expect, it } from "vitest";
import { evaluateQuorum, type ApprovalRecord } from "@/lib/governance/quorum";
import type { Role } from "@/lib/artifacts/enums";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

function approval(
  role: Role,
  decision: ApprovalRecord["decision"],
  overrides: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  return {
    role,
    decision,
    artifactHash: HASH,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("evaluateQuorum", () => {
  it("is satisfied when every required role approves the current hash", () => {
    const result = evaluateQuorum(
      ["PRODUCT_OWNER", "DOMAIN_ARCHITECT"],
      [approval("PRODUCT_OWNER", "APPROVE"), approval("DOMAIN_ARCHITECT", "APPROVE")],
      HASH,
    );
    expect(result.satisfied).toBe(true);
    expect(result.missingRoles).toEqual([]);
  });

  it("is not satisfied while a required role has not acted", () => {
    const result = evaluateQuorum(
      ["PRODUCT_OWNER", "DOMAIN_ARCHITECT"],
      [approval("PRODUCT_OWNER", "APPROVE")],
      HASH,
    );
    expect(result.satisfied).toBe(false);
    expect(result.missingRoles).toEqual(["DOMAIN_ARCHITECT"]);
  });

  it("treats a veto-role rejection as blocking even with full quorum", () => {
    const result = evaluateQuorum(
      ["PRIVACY_SECURITY_OFFICER", "DATA_STEWARD"],
      [
        approval("PRIVACY_SECURITY_OFFICER", "REJECT"),
        approval("DATA_STEWARD", "APPROVE"),
      ],
      HASH,
    );
    expect(result.satisfied).toBe(false);
    expect(result.vetoedBy).toEqual(["PRIVACY_SECURITY_OFFICER"]);
  });

  it("does not carry an approval across a content change", () => {
    const result = evaluateQuorum(
      ["PRODUCT_OWNER"],
      [approval("PRODUCT_OWNER", "APPROVE", { artifactHash: OTHER_HASH })],
      HASH,
    );
    expect(result.satisfied).toBe(false);
    expect(result.staleRoles).toEqual(["PRODUCT_OWNER"]);
    expect(result.missingRoles).toEqual(["PRODUCT_OWNER"]);
  });

  it("lets the most recent decision from a role win", () => {
    const result = evaluateQuorum(
      ["PRODUCT_OWNER"],
      [
        approval("PRODUCT_OWNER", "APPROVE", { createdAt: new Date("2026-01-01T00:00:00Z") }),
        approval("PRODUCT_OWNER", "REQUEST_CHANGES", {
          createdAt: new Date("2026-01-02T00:00:00Z"),
        }),
      ],
      HASH,
    );
    expect(result.satisfied).toBe(false);
    expect(result.missingRoles).toEqual(["PRODUCT_OWNER"]);
  });

  it("lets a role reverse an earlier rejection", () => {
    const result = evaluateQuorum(
      ["PRODUCT_OWNER"],
      [
        approval("PRODUCT_OWNER", "REJECT", { createdAt: new Date("2026-01-01T00:00:00Z") }),
        approval("PRODUCT_OWNER", "APPROVE", { createdAt: new Date("2026-01-03T00:00:00Z") }),
      ],
      HASH,
    );
    expect(result.satisfied).toBe(true);
  });
});
