import { test, expect, type Page } from '@playwright/test';

const choice = (page: Page, name: string, value: string) => page.locator(`input[name="${name}"][value="${value}"]`);

async function attend(page: Page) {
  await page.locator('#primary-name').fill('Ana García');
  await choice(page, 'attendance', 'yes').check();
  await choice(page, 'primary-bus', 'no').check();
  await choice(page, 'accompanied', 'yes').check();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Revisar respuesta' })).toBeEnabled();
});

test('inactive details are excluded and restored when returning to attendance', async ({ page }) => {
  await attend(page);
  await page.locator('#primary-dietary').fill('Sin gluten');
  await page.locator('#companion-1-name').fill('Luis Pérez');
  await choice(page, 'companion-1-bus', 'yes').check();
  await choice(page, 'attendance', 'no').check();
  await expect(page.locator('#companion-1-name')).toBeDisabled();
  await page.getByRole('button', { name: 'Revisar respuesta' }).click();
  await expect(page.locator('[data-summary]')).toContainText('no podrás asistir');
  await expect(page.locator('[data-summary]')).not.toContainText('Luis Pérez');
  await expect(page.locator('[data-summary]')).not.toContainText('Sin gluten');
  await page.getByRole('button', { name: 'Volver a editar' }).click();
  await expect(page.locator('#primary-name')).toBeFocused();
  await choice(page, 'attendance', 'yes').check();
  await expect(page.locator('#primary-dietary')).toHaveValue('Sin gluten');
  await expect(page.locator('#companion-1-name')).toHaveValue('Luis Pérez');
  await expect(page.locator('#companion-1-name')).toBeEnabled();
});

test('removing the last companion switches to solo attendance and moves focus', async ({ page }) => {
  await attend(page);
  await page.getByRole('button', { name: 'Eliminar acompañante 1', exact: true }).click();
  await expect(page.locator('[data-guest]')).toHaveCount(0);
  await expect(choice(page, 'accompanied', 'no')).toBeChecked();
  await expect(choice(page, 'accompanied', 'no')).toBeFocused();
  await expect(page.locator('[data-companions-section]')).toBeHidden();
  await page.getByRole('button', { name: 'Revisar respuesta' }).click();
  await expect(page.locator('[data-summary]')).toContainText('1 persona.');
});

test('companion limit is announced and adding is reenabled after removal', async ({ page }) => {
  await attend(page);
  const add = page.getByRole('button', { name: '+ Añadir acompañante', exact: true });
  for (let index = 1; index < 10; index++) await add.click();
  await expect(page.locator('[data-guest]')).toHaveCount(10);
  await expect(add).toBeDisabled();
  await expect(page.locator('[data-announcement]')).toContainText('Has alcanzado el máximo');
  await page.getByRole('button', { name: 'Eliminar acompañante 5', exact: true }).click();
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.locator('[data-guest]')).toHaveCount(10);
  const ids = await page.locator('[data-guest] input[data-full-name]').evaluateAll((inputs) => inputs.map((input) => input.id));
  expect(new Set(ids).size).toBe(10);
});

test('editing a person targets the correct field after companion removal', async ({ page }) => {
  await attend(page);
  await page.getByRole('button', { name: '+ Añadir acompañante', exact: true }).click();
  await page.locator('#companion-2-name').fill('Luis Pérez');
  await choice(page, 'companion-2-bus', 'yes').check();
  await page.getByRole('button', { name: 'Eliminar acompañante 1', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar respuesta' }).click();
  await expect(page.locator('[data-summary]')).toBeFocused();
  await expect(page.locator('.summary-guest').first()).toHaveCSS('border-bottom-style', 'solid');
  await page.getByRole('button', { name: 'Editar datos de Luis Pérez (Acompañante 1)', exact: true }).click();
  await expect(page.locator('#companion-2-name')).toBeFocused();
  await expect(page.locator('#primary-name')).toHaveValue('Ana García');
  await expect(choice(page, 'companion-2-bus', 'yes')).toBeChecked();
  await page.locator('#companion-2-name').fill('Luis López');
  await page.getByRole('button', { name: 'Revisar respuesta' }).click();
  await expect(page.locator('[data-summary]')).toContainText('Acompañante 1: Luis López');
  await page.getByRole('button', { name: 'Editar datos de Ana García (Tus datos)', exact: true }).click();
  await expect(page.locator('#primary-name')).toBeFocused();
});

test('validation can be corrected and the response reviewed using only the keyboard', async ({ page }) => {
  await page.locator('#primary-name').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#primary-name')).toBeFocused();
  await expect(page.locator('#primary-name')).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.type('Ana García');
  await expect(page.locator('#primary-name')).not.toHaveAttribute('aria-invalid');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(choice(page, 'attendance', 'yes')).toBeChecked();
  await expect(choice(page, 'attendance', 'yes')).not.toHaveAttribute('aria-invalid');
  await page.keyboard.press('Tab'); // Dietary text, optional.
  await page.keyboard.press('Tab'); // Bus radio group.
  await page.keyboard.press('ArrowRight');
  await expect(choice(page, 'primary-bus', 'no')).toBeChecked();
  await page.keyboard.press('Tab'); // Accompanied radio group.
  await page.keyboard.press('ArrowRight');
  await expect(choice(page, 'accompanied', 'no')).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Revisar respuesta' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-summary]')).toBeVisible();
  await expect(page.locator('[data-summary]')).toBeFocused();
});

test('long names fit both summary paths and mobile fields retain usable width', async ({ page }, testInfo) => {
  await page.locator('#primary-name').fill('A'.repeat(120));
  await choice(page, 'attendance', 'no').check();
  await page.getByRole('button', { name: 'Revisar respuesta' }).click();
  const hasHorizontalOverflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await hasHorizontalOverflow()).toBe(false);
  await page.getByRole('button', { name: 'Volver a editar' }).click();
  if (testInfo.project.name === 'mobile') {
    const bounds = await page.locator('#primary-name').boundingBox();
    expect(bounds!.width).toBeGreaterThan(250);
  }
  await choice(page, 'attendance', 'yes').check();
  await choice(page, 'primary-bus', 'no').check();
  await choice(page, 'accompanied', 'no').check();
  await page.getByRole('button', { name: 'Revisar respuesta' }).click();
  expect(await hasHorizontalOverflow()).toBe(false);
});
