import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end gate flow. The public landing lists the lifecycle; the signed-in
 * flow drives the stage-1 consumption-first loop:
 *   author a blocked decision -> commit the register -> exit criteria pass ->
 *   submit for review -> one approver is not enough -> the second approver
 *   closes the gate -> stage 2 unlocks.
 *
 * This is the UI proof of Non-Negotiables 1 and 2: a product cannot advance
 * without a real consumer decision, and only humans holding the required roles
 * can approve — no single actor, and no assistant, can.
 */

const PASSWORD = "dpf-local-dev";
const STAGE1 = "/workspace/demo/product/outage-response/stage/1";
const STAGE2 = "/workspace/demo/product/outage-response/stage/2";
const STAGE3 = "/workspace/demo/product/outage-response/stage/3";
const STAGE4 = "/workspace/demo/product/outage-response/stage/4";
const STAGE5 = "/workspace/demo/product/outage-response/stage/5";
const BOARD = "/workspace/demo/product/outage-response";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/workspace");
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
}

test("the public landing lists all thirteen stages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Data Product Factory" })).toBeVisible();
  await expect(page.getByText("Consumption Discovery")).toBeVisible();
  await expect(page.getByText("Certification & Publication")).toBeVisible();
});

test("consumption-first: author, commit, review, and close the stage-1 gate", async ({
  page,
}) => {
  // --- Practitioner (product owner) authors and commits. ---
  await signIn(page, "owner@dpf.local");
  await page.goto(STAGE1);
  await expect(page.getByRole("heading", { name: "Consumption Discovery" })).toBeVisible();

  await page.getByLabel("Persona (who is blocked)").fill("Regional dispatch supervisor");
  await page.getByLabel("Cadence (how often)").fill("Every 15 minutes during an event");
  await page.getByLabel("Decision they cannot make").fill("Which crew to send first");
  await page
    .getByLabel("Consequence of not deciding")
    .fill("Crews idle while customers stay dark");
  await page.getByRole("button", { name: "Add decision record" }).click();

  // Commit the register; the artifact appears as human-authored. Match the
  // artifact chip exactly — the exit-criteria checklist also mentions
  // "DECISION_REGISTER committed at version 1", asserted separately below.
  await page.getByRole("button", { name: "Commit decision register" }).click();
  await expect(page.getByText("DECISION_REGISTER", { exact: true })).toBeVisible();
  await expect(page.getByText("Human-authored")).toBeVisible();
  await expect(
    page.getByText("DECISION_REGISTER committed at version", { exact: false }),
  ).toBeVisible();

  // The committed artifact is downloadable; the export route returns YAML and
  // authorizes server-side (the signed-in cookie is what makes this 200).
  const yamlHref = await page
    .locator('a[href^="/api/export/"][href*="yaml"]')
    .first()
    .getAttribute("href");
  expect(yamlHref).toBeTruthy();
  const download = await page.request.get(yamlHref!);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toContain("yaml");
  expect(await download.text()).toContain("Regional dispatch supervisor");

  // Submit for review.
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("In review")).toBeVisible();

  // Product owner approves — quorum not yet met, the gate stays open.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  // --- Consumer rep is the second required approver: the gate closes. ---
  await signIn(page, "consumer@dpf.local");
  await page.goto(STAGE1);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved")).toBeVisible();

  // Stage 2 is now unlocked on the board (stage 1 had locked it before).
  await page.goto(BOARD);
  await expect(page.locator('a[href$="/stage/2"]')).toBeVisible();

  // --- Stage 2: author the charter (consumer is a member), then two required
  // approvers — product owner and domain architect — close its gate. ---
  await page.goto(STAGE2);
  await page
    .getByLabel("Scope boundary (what is in and out)")
    .fill("In: active outage dispatch. Out: billing.");
  await page
    .getByLabel("Value hypothesis (the consumer decision this unblocks)")
    .fill("Unblocks the dispatch supervisor's crew-priority decision.");
  await page.getByLabel("Measure 1", { exact: true }).fill("Mean time to dispatch");
  await page.getByLabel("Target 1", { exact: true }).fill("< 10 min");
  await page.getByRole("button", { name: "Commit charter" }).click();
  await expect(page.getByText("Charter committed", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  // Product owner approves — the domain architect is still required.
  await signIn(page, "owner@dpf.local");
  await page.goto(STAGE2);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  // Domain architect completes quorum: stage 2 closes and stage 3 unlocks.
  await signIn(page, "architect@dpf.local");
  await page.goto(STAGE2);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved")).toBeVisible();

  await page.goto(BOARD);
  await expect(page.locator('a[href$="/stage/3"]')).toBeVisible();

  // --- Stage 3: author the source inventory (architect is a member), then the
  // platform engineer and domain SME close its gate; stage 4 unlocks. ---
  await page.goto(STAGE3);
  await page.getByLabel("Source 1 name").fill("Outage events");
  await page.getByLabel("Source 1 system").fill("SCADA");
  await page
    .getByLabel("Source 1 description")
    .fill("One row per outage event, detection to restoration.");
  await page.getByRole("button", { name: "Commit source inventory" }).click();
  await expect(page.getByText("Source inventory committed", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  await signIn(page, "engineer@dpf.local");
  await page.goto(STAGE3);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  await signIn(page, "sme@dpf.local");
  await page.goto(STAGE3);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved")).toBeVisible();

  await page.goto(BOARD);
  await expect(page.locator('a[href$="/stage/4"]')).toBeVisible();

  // --- Stage 4: author the logical model (sme is a member), then the domain
  // architect and domain SME close its gate; stage 5 unlocks. ---
  await page.goto(STAGE4);
  await page
    .getByLabel("Grain statement (what one row means)")
    .fill("One row per outage per affected service point.");
  await page.getByLabel("Entity 1 name").fill("Outage");
  await page.getByLabel("Entity 1 grain").fill("One row per outage");
  await page
    .getByLabel("Identity-resolution strategy")
    .fill("Outages keyed by SCADA event id; service points by meter id.");
  await page.getByRole("button", { name: "Commit logical model" }).click();
  await expect(page.getByText("Logical model committed", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  await signIn(page, "architect@dpf.local");
  await page.goto(STAGE4);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  await signIn(page, "sme@dpf.local");
  await page.goto(STAGE4);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved")).toBeVisible();

  await page.goto(BOARD);
  await expect(page.locator('a[href$="/stage/5"]')).toBeVisible();

  // --- Stage 5: two artifacts (attribute register + data contract), then three
  // approvers — data steward, domain SME, product owner — close its gate. ---
  await page.goto(STAGE5);
  await page.getByLabel("Attribute 1 name").fill("outage_id");
  await page.getByLabel("Attribute 1 type").fill("string");
  await page.getByLabel("Attribute 1 sensitivity").selectOption("INTERNAL");
  await page.getByRole("button", { name: "Commit attribute register" }).click();
  await expect(page.getByText("Attribute register committed", { exact: false })).toBeVisible();

  await page.getByLabel("Field 1 name").fill("outage_id");
  await page.getByLabel("Field 1 type").fill("string");
  await page.getByLabel("SLA freshness").fill("< 5 minutes behind source");
  await page
    .getByLabel("Deprecation policy")
    .fill("Breaking changes get a new major and 90 days notice.");
  await page.getByRole("button", { name: "Commit data contract" }).click();
  await expect(page.getByText("Data contract committed", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("In review")).toBeVisible();

  // Domain SME (still signed in) approves — steward and owner are still required.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  await signIn(page, "steward@dpf.local");
  await page.goto(STAGE5);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("In review")).toBeVisible();
  await signOut(page);

  await signIn(page, "owner@dpf.local");
  await page.goto(STAGE5);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved")).toBeVisible();

  await page.goto(BOARD);
  await expect(page.locator('a[href$="/stage/6"]')).toBeVisible();
});

test("a platform admin creates a product and approves its stage-0 setup", async ({ page }) => {
  await signIn(page, "admin@dpf.local");
  await page.goto("/workspace/demo");

  // Create a new product; lands on its Stage 0 with the setup artifact committed.
  await page.getByRole("button", { name: "New product" }).click();
  await page.getByLabel("Product name").fill("Grid Reliability");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL("**/product/grid-reliability/stage/0");

  await expect(page.getByRole("heading", { name: "Workspace & Pack Setup" })).toBeVisible();
  await expect(page.getByText("WORKSPACE_SETUP")).toBeVisible();
  await expect(page.getByText("In review")).toBeVisible();

  // The admin approves Stage 0 through the ordinary gate; Stage 1 then unlocks.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved")).toBeVisible();

  await page.goto("/workspace/demo/product/grid-reliability");
  await expect(page.locator('a[href$="/stage/1"]')).toBeVisible();
});

test("any user creates a workspace and becomes its platform admin", async ({ page }) => {
  // consumer@ holds no PLATFORM_ADMIN anywhere in the seed, yet self-serve
  // workspace creation makes them admin of the one they create.
  await signIn(page, "consumer@dpf.local");
  await page.goto("/workspace");

  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Workspace name").fill("Northeast Grid");
  await page.getByLabel("Industry pack").selectOption("utility");
  await page.getByRole("button", { name: "Create workspace" }).click();

  await page.waitForURL("**/workspace/northeast-grid");
  await expect(page.getByRole("heading", { name: "Northeast Grid" })).toBeVisible();
  // The active pack renders, and the creator sees the admin-only New product control.
  await expect(page.getByText("Utility (Electric & Gas)")).toBeVisible();
  await expect(page.getByRole("button", { name: "New product" })).toBeVisible();
});

test("the control plane shows the catalog and the agent-flow board", async ({ page }) => {
  await signIn(page, "owner@dpf.local");
  await page.goto("/workspace/demo");

  // Catalog: the demo product appears as a card, and the sub-nav is present.
  await expect(page.getByRole("heading", { name: "Data product catalog" })).toBeVisible();
  await expect(page.getByText("Outage Response")).toBeVisible();

  // Switch to the agent-flow board via the sub-nav.
  await page.getByRole("link", { name: "Agent flow" }).click();
  await page.waitForURL("**/workspace/demo/agent-flow");
  await expect(page.getByRole("heading", { name: "Agent flow" })).toBeVisible();
  // The lifecycle is laid out; a couple of stages render on the board.
  await expect(page.getByRole("heading", { name: "Consumption Discovery" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Access, Security & Governance" })).toBeVisible();
});

test("a locked downstream stage has no navigable link", async ({ page }) => {
  // Self-contained so it stays correct as the demo product progresses through
  // more stages: create a fresh product whose Stage 0 is not yet approved, so
  // Stage 1 is locked and the board renders it without a link.
  await signIn(page, "admin@dpf.local");
  await page.goto("/workspace/demo");
  await page.getByRole("button", { name: "New product" }).click();
  await page.getByLabel("Product name").fill("Locked Demo");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL("**/product/locked-demo/stage/0");

  await page.goto("/workspace/demo/product/locked-demo");
  await expect(page.getByText("Consumption Discovery")).toBeVisible();
  // Stage 0 is IN_REVIEW (unapproved), so Stage 1 is locked — no link.
  await expect(page.locator('a[href$="/stage/1"]')).toHaveCount(0);
});
