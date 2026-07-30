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

  // Commit the register; the artifact appears as human-authored.
  await page.getByRole("button", { name: "Commit decision register" }).click();
  await expect(page.getByText("DECISION_REGISTER")).toBeVisible();
  await expect(page.getByText("Human-authored")).toBeVisible();
  await expect(
    page.getByText("DECISION_REGISTER committed at version", { exact: false }),
  ).toBeVisible();

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

test("a locked downstream stage has no navigable link", async ({ page }) => {
  // Stage 5's gate is locked because earlier gates are unapproved, so the board
  // renders it without a link to open it.
  await signIn(page, "owner@dpf.local");
  await page.goto(BOARD);
  await expect(page.getByText("Attribute Register & Data Contract")).toBeVisible();
  await expect(page.locator('a[href$="/stage/5"]')).toHaveCount(0);
});
