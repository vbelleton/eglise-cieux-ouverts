import { test, expect } from "@playwright/test";
import { resetMock } from "./helpers/reset";

test.describe("Menu mobile et cartes", () => {
  test("toucher le lien de la page courante ferme le menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contact");
    await page.locator(".burger").click();
    await expect(page.locator(".site-header")).toHaveClass(/menu-open/);
    await page.locator('.nav-mobile a[href="/contact"]').first().click();
    await expect(page.locator(".site-header")).not.toHaveClass(/menu-open/);
  });

  test("logos réseaux du menu mobile : pastille claire, icône bleue lisible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator(".burger").click();
    const lien = page.locator(".nav-mobile-socials a").first();
    await expect(lien).toBeVisible();
    const style = await lien.evaluate((el) => {
      const c = getComputedStyle(el);
      return { bg: c.backgroundColor, w: c.width, color: c.color };
    });
    expect(style.w).toBe("44px");
    expect(style.bg).toMatch(/rgba?\(255, 255, 255/);
    expect(style.color).toBe("rgb(6, 72, 134)");
  });

  test("carte Google dans un bloc texte : cadre léger, la vraie carte ne charge qu'au toucher", async ({ page, request }) => {
    await resetMock(request);
    const carte = '<iframe title="Carte test" src="https://www.google.com/maps?q=Morlaix&output=embed" width="100%" height="320" loading="lazy"></iframe>';
    const res = await request.put("/api/pages/messages", {
      data: { blocks: [{ id: "t1", type: "richText", props: { content: `<p>Où nous trouver</p>${carte}`, padding: 20 }, visibility: { desktop: true, tablet: true, mobile: true } }] },
    });
    expect(res.ok()).toBe(true);
    const requetes: string[] = [];
    page.on("request", (r) => { if (r.url().includes("google.com/maps")) requetes.push(r.url()); });
    await page.route("**/google.com/maps**", (r) => r.fulfill({ body: "<html></html>", contentType: "text/html" }));
    await page.goto("/messages");
    const cadre = page.locator(".map-facade").first();
    await expect(cadre).toBeVisible();
    await page.waitForTimeout(500);
    expect(requetes).toEqual([]);
    await cadre.getByRole("button", { name: "Afficher la carte" }).click();
    await expect(cadre.locator("iframe")).toHaveAttribute("src", /google\.com\/maps/);
  });

  test("un iframe YouTube dans un bloc texte n'est pas remplacé", async ({ page, request }) => {
    await resetMock(request);
    const yt = '<iframe title="Vidéo" src="https://www.youtube.com/embed/abc" width="100%" height="200"></iframe>';
    await request.put("/api/pages/messages", {
      data: { blocks: [{ id: "t2", type: "richText", props: { content: yt, padding: 20 }, visibility: { desktop: true, tablet: true, mobile: true } }] },
    });
    await page.route("**/youtube.com/**", (r) => r.fulfill({ body: "<html></html>", contentType: "text/html" }));
    await page.goto("/messages");
    await expect(page.locator(".richtext-inner iframe")).toHaveCount(1);
    await expect(page.locator(".map-facade")).toHaveCount(0);
  });
});
