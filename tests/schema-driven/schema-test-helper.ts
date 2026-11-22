import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { FieldSchema } from '../../lib/blocks/types'

const ALL_VALID_TYPES = [
  'text', 'textarea', 'richtext', 'number', 'color',
  'boolean', 'select', 'animation', 'image', 'array', 'images',
] as const

export async function editField(
  page: Page,
  blockIndex: number,
  fieldLabel: string,
  value: string
) {
  const wrapper = page.locator('.block-wrapper').nth(blockIndex)
  if (!(await wrapper.isVisible())) return
  await wrapper.click()
  await page.waitForTimeout(300)
  const autoEditor = page.locator('.admin-sidebar .auto-editor')
  if (!(await autoEditor.isVisible())) return
  const field = autoEditor.locator('.auto-field').filter({ hasText: fieldLabel }).first()
  const input = field.locator('input, textarea, select, [contenteditable="true"]').first()
  if (await input.isVisible()) {
    await input.fill(value)
    await page.waitForTimeout(100)
  }
}

export async function toggleField(
  page: Page,
  blockIndex: number,
  fieldLabel: string
) {
  const wrapper = page.locator('.block-wrapper').nth(blockIndex)
  if (!(await wrapper.isVisible())) return
  await wrapper.click()
  await page.waitForTimeout(300)
  const field = page.locator('.admin-sidebar .auto-editor .auto-field').filter({ hasText: fieldLabel }).first()
  const checkbox = field.locator('input[type="checkbox"]')
  if (await checkbox.isVisible()) {
    await checkbox.click()
    await page.waitForTimeout(100)
  }
}

export async function selectField(
  page: Page,
  blockIndex: number,
  fieldLabel: string,
  value: string
) {
  const wrapper = page.locator('.block-wrapper').nth(blockIndex)
  if (!(await wrapper.isVisible())) return
  await wrapper.click()
  await page.waitForTimeout(300)
  const field = page.locator('.admin-sidebar .auto-editor .auto-field').filter({ hasText: fieldLabel }).first()
  const select = field.locator('select')
  if (await select.isVisible()) {
    await select.selectOption(value)
    await page.waitForTimeout(100)
  }
}

export async function selectAnimation(
  page: Page,
  blockIndex: number,
  animLabel: string
) {
  const wrapper = page.locator('.block-wrapper').nth(blockIndex)
  if (!(await wrapper.isVisible())) return
  await wrapper.click()
  await page.waitForTimeout(300)
  const field = page.locator('.admin-sidebar .auto-editor .auto-field').filter({ hasText: 'Animation' }).first()
  const btn = field.locator('.anim-btn').filter({ hasText: animLabel })
  if (await btn.isVisible()) {
    await btn.click()
    await page.waitForTimeout(100)
  }
}

export function validateSchema(blockType: string, schema: FieldSchema[], defaults: Record<string, any>) {
  test(`${blockType}: all schema fields have defaults`, () => {
    for (const field of schema) {
      expect(
        Object.prototype.hasOwnProperty.call(defaults, field.key),
        `${blockType}.${field.key}: missing default value`
      ).toBe(true)
    }
  })

  test(`${blockType}: all field types are valid`, () => {
    for (const field of schema) {
      expect(
        ALL_VALID_TYPES,
        `${blockType}.${field.key}: invalid type "${field.type}"`
      ).toContain(field.type)
    }
  })

  test(`${blockType}: schema keys are unique`, () => {
    const keys = schema.map(f => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test(`${blockType}: all fields have labels`, () => {
    for (const field of schema) {
      expect(field.label, `${blockType}.${field.key}: missing label`).toBeTruthy()
    }
  })

  test(`${blockType}: number fields have min/max`, () => {
    for (const field of schema) {
      if (field.type === 'number') {
        expect(field.min, `${blockType}.${field.key}: missing min`).toBeDefined()
        expect(field.max, `${blockType}.${field.key}: missing max`).toBeDefined()
      }
    }
  })

  test(`${blockType}: select fields have options`, () => {
    for (const field of schema) {
      if (field.type === 'select') {
        expect(
          field.options?.length, `${blockType}.${field.key}: missing options`
        ).toBeGreaterThanOrEqual(1)
      }
    }
  })
}
