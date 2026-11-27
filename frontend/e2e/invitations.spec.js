import { test, expect } from '@playwright/test';

test('invitation page confirms password and returns to login', async ({ page }) => {
  await page.route('**/api/account/set-password/', async (route) => {
    const data = route.request().postDataJSON();
    expect(data.invitation).toBe(12);
    expect(data.token).toBe('demo-token');
    expect(data.password).toBe('PatientOwnSecret!2026');
    expect(data.password_confirm).toBe(data.password);
    await route.fulfill({ json: { detail: 'Success' } });
  });
  await page.goto('/set-password?invitation=12&token=demo-token');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('PatientOwnSecret!2026');
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('PatientOwnSecret!2026');
  await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();
  await expect(page.getByText('Thiết lập mật khẩu thành công.')).toBeVisible();
  await expect(page).toHaveURL(/\/set-password$/);
  await page.getByRole('link', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('invitation page shows expired link errors', async ({ page }) => {
  await page.route('**/api/account/set-password/', (route) => route.fulfill({
    status: 400, json: { detail: 'Link đã hết hạn. Vui lòng liên hệ lễ tân.' },
  }));
  await page.goto('/set-password?invitation=12&token=expired-token');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('PatientOwnSecret!2026');
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('PatientOwnSecret!2026');
  await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();
  await expect(page.getByText('Link đã hết hạn. Vui lòng liên hệ lễ tân.')).toBeVisible();
});
