import { test, expect } from '@playwright/test'
import { BLOCK_TYPES } from '../../utils/blockTypes.js'
import { validateSchema } from './schema-test-helper.js'

const HERO_SCHEMA = (BLOCK_TYPES as any).hero?.schema || []
const HERO_DEFAULTS = (BLOCK_TYPES as any).hero?.defaults || {}

test.describe('BlockHero — Schema-driven tests', () => {

  // ─── Schema validation (no page load needed) ────────────────────────────

  validateSchema('hero', HERO_SCHEMA, HERO_DEFAULTS)

  test('schema has correct field count', () => {
    expect(HERO_SCHEMA.length).toBe(7) // « Afficher bouton » retiré : aucun bouton n'est rendu par le Hero
  })

  test('height field has min/max constraints', () => {
    const heightField = HERO_SCHEMA.find((f: any) => f.key === 'height')
    expect(heightField).toBeDefined()
    expect(heightField.min).toBe(200)
    expect(heightField.max).toBe(900)
  })

  test('default height is 700', () => {
    expect(HERO_DEFAULTS.height).toBe(700)
  })

  test('default image is set', () => {
    expect(HERO_DEFAULTS.image).toBeTruthy()
    expect(typeof HERO_DEFAULTS.image).toBe('string')
  })

  test('createBlock works for hero', () => {
    const { createBlock } = require('../../utils/blockTypes.js')
    const block = createBlock('hero')
    expect(block).not.toBeNull()
    expect(block.type).toBe('hero')
    expect(block.props?.image).toBe(HERO_DEFAULTS.image)
    expect(block.visibility?.desktop).toBe(true)
  })

  // ─── Rendering tests ────────────────────────────────────────────────────

  test('renders hero block on home page', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)
    const hero = page.locator('.block-main-hero')
    await expect(hero).toBeVisible({ timeout: 5000 })
  })

  test('hero has background image', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    const img = page.locator('.hero-bg')
    await expect(img).toBeVisible()
    const src = await img.getAttribute('src')
    expect(src).toBeTruthy()
  })

  test('hero has title/logo images', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    const nameImg = page.locator('.hero-name')
    await expect(nameImg).toBeVisible()
  })

  test('hero has correct CSS class structure', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    const hero = page.locator('.block-main-hero')
    await expect(hero).toBeVisible()
    await expect(hero.locator('.hero-bg')).toBeVisible()
    await expect(hero.locator('.hero-content')).toBeVisible()
  })

  test('hero wrapper gets admin-selected on click', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)
    const hero = page.locator('.block-main-hero')
    await expect(hero).toBeVisible()
    const wrapper = hero.locator('..')
    await wrapper.click()
    await page.waitForTimeout(200)
    await expect(wrapper).toHaveClass(/admin-selected/)
  })

  test('hero renders without JS (SSR)', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('.block-main-hero')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.hero-content')).toBeVisible()
    await context.close()
  })

  // ─── Admin editor tests ─────────────────────────────────────────────────

  test('hero schema fields appear in sidebar AutoEditor', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)
    const hero = page.locator('.block-main-hero')
    await hero.locator('..').click()
    await page.waitForTimeout(300)
    // Check AutoEditor labels exist in the DOM
    for (const field of HERO_SCHEMA.slice(0, 3)) {
      await expect(page.locator(`.admin-sidebar label:has-text("${field.label}")`).first()).toBeVisible()
    }
  })
})
