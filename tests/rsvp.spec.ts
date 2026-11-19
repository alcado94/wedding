import { test, expect, type Page } from '@playwright/test';
import { RSVP_ENDPOINT } from '../src/lib/rsvp-submit';

const choice = (page: Page, name: string, value: string) => page.locator(`input[name="${name}"][value="${value}"]`);

async function attend(page: Page) {
  await page.locator('#primary-name').fill('Ana García');
  await choice(page, 'attendance', 'yes').check();
  await choice(page, 'primary-bus', 'no').check();
  await choice(page, 'accompanied', 'yes').check();
}

test.beforeEach(async ({ page }) => {
  await page.route(RSVP_ENDPOINT, async (route) => {
    const { submissionId } = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, submissionId } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enviar respuesta' })).toBeEnabled();
});

test('inactive details are excluded and restored when returning to attendance', async ({ page }) => {
  await attend(page);
  await page.locator('#primary-dietary').fill('Sin gluten');
  await page.locator('#companion-1-name').fill('Luis Pérez');
  await choice(page, 'companion-1-bus', 'yes').check();
  await choice(page, 'attendance', 'no').check();
  await expect(page.locator('#companion-1-name')).toBeDisabled();
  await choice(page, 'attendance', 'yes').check();
  await expect(page.locator('#primary-dietary')).toHaveValue('Sin gluten');
  await expect(page.locator('#companion-1-name')).toHaveValue('Luis Pérez');
  await expect(page.locator('#companion-1-name')).toBeEnabled();
  await choice(page, 'attendance', 'no').check();
  const request = page.waitForRequest(RSVP_ENDPOINT);
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  expect((await request).postDataJSON().response).toEqual({ attending: false, fullName: 'Ana García' });
  await expect(page.locator('[data-summary]')).toContainText('no podrás asistir');
  await expect(page.locator('[data-summary]')).not.toContainText('Luis Pérez');
  await expect(page.locator('[data-summary]')).not.toContainText('Sin gluten');
  await expect(page.getByRole('button', { name: /editar/i })).toHaveCount(0);
});

test('removing the last companion switches to solo attendance and moves focus', async ({ page }) => {
  await attend(page);
  await page.getByRole('button', { name: 'Eliminar acompañante 1', exact: true }).click();
  await expect(page.locator('[data-guest]')).toHaveCount(0);
  await expect(choice(page, 'accompanied', 'no')).toBeChecked();
  await expect(choice(page, 'accompanied', 'no')).toBeFocused();
  await expect(page.locator('[data-companions-section]')).toBeHidden();
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
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

test('submission stores the remaining people and exposes no editing controls', async ({ page }) => {
  await attend(page);
  await page.getByRole('button', { name: '+ Añadir acompañante', exact: true }).click();
  await page.locator('#companion-2-name').fill('Luis Pérez');
  await choice(page, 'companion-2-bus', 'yes').check();
  await page.getByRole('button', { name: 'Eliminar acompañante 1', exact: true }).click();
  const request = page.waitForRequest(RSVP_ENDPOINT);
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  expect((await request).postDataJSON().response).toEqual({
    attending: true,
    guest: { fullName: 'Ana García', dietary: '', needsBus: false },
    companions: [{ fullName: 'Luis Pérez', dietary: '', needsBus: true }],
  });
  await expect(page.locator('[data-summary]')).toBeFocused();
  await expect(page.locator('.summary-guest').first()).toHaveCSS('border-bottom-style', 'solid');
  await expect(page.locator('[data-summary]')).toContainText('Acompañante 1: Luis Pérez');
  await expect(page.getByRole('button', { name: /editar/i })).toHaveCount(0);
  await expect(page.locator('[data-reference]')).toContainText('Referencia:');
});

test('validation can be corrected and the response submitted using only the keyboard', async ({ page }) => {
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
  await expect(page.getByRole('button', { name: 'Enviar respuesta' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-summary]')).toBeVisible();
  await expect(page.locator('[data-summary]')).toBeFocused();
});

test('long names fit both summary paths and mobile fields retain usable width', async ({ page }, testInfo) => {
  await page.locator('#primary-name').fill('A'.repeat(120));
  await choice(page, 'attendance', 'no').check();
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  await expect(page.locator('[data-summary]')).toBeVisible();
  const hasHorizontalOverflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await hasHorizontalOverflow()).toBe(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enviar respuesta' })).toBeEnabled();
  if (testInfo.project.name === 'mobile') {
    const bounds = await page.locator('#primary-name').boundingBox();
    expect(bounds!.width).toBeGreaterThan(250);
  }
  await page.locator('#primary-name').fill('A'.repeat(120));
  await choice(page, 'attendance', 'yes').check();
  await choice(page, 'primary-bus', 'no').check();
  await choice(page, 'accompanied', 'no').check();
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  await expect(page.locator('[data-summary]')).toBeVisible();
  expect(await hasHorizontalOverflow()).toBe(false);
});

test('pending submission is locked and retries the identical payload after a lost response', async ({ page }) => {
  const payloads: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(RSVP_ENDPOINT, async (route) => {
    payloads.push(route.request().postData()!);
    expect(route.request().headers()['content-type']).toBe('text/plain;charset=UTF-8');
    if (payloads.length === 1) {
      await gate;
      await route.abort();
    } else {
      await route.fulfill({ json: { ok: true, submissionId: JSON.parse(payloads[0]).submissionId } });
    }
  });
  await page.locator('#primary-name').fill('Ana García');
  await choice(page, 'attendance', 'no').check();
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  await expect(page.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  await expect(page.locator('#primary-name')).toBeDisabled();
  await expect(page.locator('[data-summary]')).toBeHidden();
  await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  expect(payloads).toHaveLength(1);
  release();
  await expect(page.locator('[data-form-error]')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar envío' }).click();
  await expect(page.locator('[data-summary]')).toBeVisible();
  expect(payloads).toHaveLength(2);
  expect(payloads[1]).toBe(payloads[0]);
});

for (const failure of ['rejected', 'wrong-reference', 'html', 'http-error', 'timeout']) {
  test(`does not confirm a ${failure} response`, async ({ page }) => {
    if (failure === 'timeout') await page.clock.install();
    await page.route(RSVP_ENDPOINT, async (route) => {
      if (failure === 'timeout') {
        await new Promise<void>((resolve) => route.request().response().then(() => resolve()).catch(() => resolve()));
        return;
      }
      if (failure === 'html') await route.fulfill({ contentType: 'text/html', body: '<html>Login required</html>' });
      else if (failure === 'http-error') await route.fulfill({ status: 503, body: 'Unavailable' });
      else await route.fulfill({ json: failure === 'rejected' ? { ok: false } : { ok: true, submissionId: 'wrong' } });
    });
    await page.locator('#primary-name').fill('Ana García');
    await choice(page, 'attendance', 'no').check();
    await page.getByRole('button', { name: 'Enviar respuesta' }).click();
    if (failure === 'timeout') await page.clock.fastForward(31000);
    await expect(page.getByRole('button', { name: 'Reintentar envío' })).toBeEnabled();
    await expect(page.locator('[data-summary]')).toBeHidden();
    await expect(page.locator('#primary-name')).toHaveValue('Ana García');
  });
}
