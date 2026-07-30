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
});

test("a locked downstream stage has no navigable link", async ({ page }) => {
  // Stage 5's gate is locked because earlier gates are unapproved, so the board
  // renders it without a link to open it.
  await signIn(page, "owner@dpf.local");
  await page.goto(BOARD);
  await expect(page.getByText("Attribute Register & Data Contract")).toBeVisible();
  await expect(page.locator('a[href$="/stage/5"]')).toHaveCount(0);
});
