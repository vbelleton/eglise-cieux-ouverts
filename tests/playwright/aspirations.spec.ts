import { test, expect } from "@playwright/test";

test.describe("Aspirations animation", () => {
  test("SSR content without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");

    // BlockAspirations
    await expect(page.locator(".aspirations-viewport")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".aspirations-viewport .circle")).toHaveCount(4);

    // BlockBienvenue — text must be visible (opacity 1 in SSR)
    await expect(page.locator(".block-bienvenue")).toBeVisible();
    await expect(page.locator(".hero-bienvenue-char").first()).toBeVisible();

    // BlockRejoins — content must be visible (opacity 1 in SSR fallback)
    // In SSR no-JS, we check that content is present (triggered class is added by IntersectionObserver in non-SSR)
    await expect(page.locator(".block-rejoins")).toBeVisible();
    await expect(page.locator(".rejoins-title")).toHaveText("Rejoins-nous");

    // BlockVision — content must be visible in SSR/no-JS even before client-side triggers
    await expect(page.locator(".vision-section")).toBeVisible();
    await expect(page.locator(".vision-label")).toBeVisible();
    await expect(page.locator(".vision-quote")).toBeVisible();

    // Footer "Il y a une place pour toi !" — shutter chars must be visible in SSR (no-JS fallback CSS)
    await expect(page.locator(".shutter-char").first()).toBeVisible();
    await expect(page.locator(".footer-title")).toBeVisible();
    // Verify the text (spaces are &nbsp; = non-breaking \xa0)
    const footerText = await page.locator(".footer-title").innerText();
    expect(footerText.replace(/\xa0/g, " ")).toContain(
      "Il y a une place pour toi",
    );

    await context.close();
  });

  test("page loads with JS without 500 error", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(2000);

    // Verify no Nuxt error
    const title = await page.title();
    expect(title).not.toContain("500");
    expect(title).toContain("Cieux Ouverts");

    // Verify SSR blocks are present
    await expect(page.locator(".aspirations-viewport")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(".block-bienvenue")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(".block-rejoins")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".vision-section")).toBeVisible({
      timeout: 5000,
    });

    // Verify no page errors
    expect(errors).toEqual([]);
  });

  test("circles are rendered correctly", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(1000);

    const viewport = page.locator(".aspirations-viewport");
    await expect(viewport).toBeVisible({ timeout: 5000 });

    const circles = page.locator(".aspirations-viewport .circle");
    const count = await circles.count();
    expect(count).toBe(4);

    const texts = page.locator(".aspirations-viewport .text");
    expect(await texts.count()).toBe(4);

    // Verify aspiration texts
    await expect(texts.nth(0)).toHaveText(/Accueillir/);
    await expect(texts.nth(1)).toHaveText(/Célébrer/);
    await expect(texts.nth(2)).toHaveText(/Accompagner/);
    await expect(texts.nth(3)).toHaveText(/Partager/);

    expect(errors).toEqual([]);
  });

  test("content of internal blocks is visible in public mode", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Public mode (no admin)
    await page.goto("/");
    await page.waitForTimeout(500);

    // Scroll vers le bloc rejoins
    const rejoinsWrapper = page.locator(
      '.block-wrapper[data-block-type="rejoins"]',
    );
    await rejoinsWrapper.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // En Chromium (scroll-driven supporté), la classe triggered n'est PAS ajoutée
    // aux blocs SCROLL_DRIVEN_TYPES (rejoins, aspirations) car ils utilisent
    // des animations CSS natives via view-timeline.
    // On vérifie juste que le contenu est visible.
    await expect(rejoinsWrapper).toBeVisible();
    await expect(page.locator(".rejoins-title")).toContainText("Rejoins-nous");

    // Scroll vers le bloc aspirations
    const aspirationsWrapper = page.locator(
      '.block-wrapper[data-block-type="aspirations"]',
    );
    await aspirationsWrapper.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(aspirationsWrapper).toBeVisible();
    await expect(page.locator(".aspirations-viewport")).toBeVisible();

    // Scroll vers bienvenue (wrapper animation → contenu visible)
    const bienvenueWrapper = page.locator(
      '.block-wrapper[data-block-type="bienvenue"]',
    );
    await bienvenueWrapper.scrollIntoViewIfNeeded();
    await expect(bienvenueWrapper).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.hero-bienvenue-portal')).toBeVisible({ timeout: 3000 });

    expect(errors).toEqual([]);
  });
  test("smartphone : aspirations en cartes numérotées, badges masqués sur ordi", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const badges = page.locator(".aspirations-viewport .badge");
    await expect(badges).toHaveCount(4);
    await expect(badges.nth(0)).toBeVisible();
    await expect(badges.nth(0)).toHaveText("1");
    await expect(badges.nth(3)).toHaveText("4");
    await expect(page.locator(".aspirations-viewport .circle").first()).toBeHidden();
    const li = page.locator(".aspirations-list li").first();
    expect(await li.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("14px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(badges.nth(0)).toBeHidden();
  });
});
