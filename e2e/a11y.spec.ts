import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Gate accessibility at the "serious"/"critical" impact levels on the public,
// shadcn/ui-built pages, with every axe rule on, including color-contrast.
// Lower-impact findings are not failed here (they'd be a separate, dedicated
// a11y pass), but serious/critical regressions break CI.
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

for (const path of [
  "/",
  "/products/ce-formula-flash-cards",
  "/products/ultimate-ce-posters-2-0",
  "/products/ce-solving-notebook",
  "/exams/ce",
  "/exams/me",
  "/reviews",
  "/reviews?exam=cpa&stars=3-or-less",
  "/about",
  "/legal/privacy",
  "/legal/terms",
]) {
  test(`no serious or critical accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);

    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ""));

    // Surface the offending rule ids + node counts in the failure message.
    const summary = blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
