import { test, expect } from '@playwright/test';

async function login(page, username) {
  await page.goto('/login');
  await page.locator('input').first().fill(username);
  await page.locator('input[type="password"]').fill('ClinicDemo2026!');
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test('three roles stay isolated across tabs in the same browser', async ({ context }) => {
  const patient = await context.newPage();
  const doctor = await context.newPage();
  const reception = await context.newPage();
  await login(patient, 'demo_patient');
  await expect(patient).toHaveURL(/\/dashboard$/);
  await login(doctor, 'dr.jane');
  await expect(doctor).toHaveURL(/\/doctor\/dashboard$/);
  await login(reception, 'demo_reception');
  await expect(reception).toHaveURL(/\/reception$/);

  const identity = (page) => page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:8011/api/me/', {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` },
    });
    return response.json();
  });
  expect((await identity(patient)).username).toBe('demo_patient');
  expect((await identity(doctor)).username).toBe('dr.jane');
  expect((await identity(reception)).username).toBe('demo_reception');

  await patient.reload();
  await expect(patient.getByRole('heading', { name: /Demo Patient/ })).toBeVisible();
  await doctor.evaluate(() => sessionStorage.setItem('accessToken', 'expired-access'));
  await doctor.reload();
  await expect(doctor.getByRole('heading', { name: /Jane Doe/ })).toBeVisible();
  expect((await identity(patient)).username).toBe('demo_patient');
  expect((await identity(doctor)).username).toBe('dr.jane');

  await reception.getByRole('button', { name: 'Log Out' }).click();
  await expect(reception).toHaveURL(/\/login$/);
  expect((await identity(patient)).username).toBe('demo_patient');
  expect((await identity(doctor)).username).toBe('dr.jane');
  expect(await reception.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();

  const newTab = await context.newPage();
  await newTab.goto('/dashboard');
  await expect(newTab).toHaveURL(/\/login$/);
});

test('patient sees bookings and can log out', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'demo_patient');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Demo Patient/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('patient-desktop.png'), fullPage: true });
  await page.getByText('My Appointments', { exact: true }).first().click();
  await expect(page.getByText('Jane Doe', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test('reception checks in patient and doctor sees waiting patient', async ({ page }, testInfo) => {
  await login(page, 'demo_reception');
  await expect(page).toHaveURL(/\/reception$/);
  await expect(page.getByRole('heading', { name: 'Patient Information' })).toBeVisible();
  await page.getByRole('link', { name: 'Check-in' }).click();
  const card = page.getByTestId('appointment-card').filter({ hasText: 'Dr. Jane Doe' });
  await expect(card).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reception-desktop.png'), fullPage: true });
  await card.getByRole('button', { name: 'Check-in', exact: true }).click();
  await expect(page.getByTestId('queue-number')).toHaveText('1');
  await page.locator('.ant-modal-footer').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('tab', { name: 'Completed' }).click();
  await expect(page.getByText('Checked-in • No. 1')).toBeVisible();
  await page.getByRole('button', { name: 'Log Out' }).click();
  await login(page, 'dr.jane');
  await expect(page).toHaveURL(/\/doctor\/dashboard$/);
  await expect(page.getByRole('button', { name: 'Bắt đầu khám ngay' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('doctor-desktop.png'), fullPage: true });
});

test('reception registers a new patient then books for them', async ({ page }) => {
  await login(page, 'demo_reception');
  await expect(page).toHaveURL(/\/reception$/);
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Browser Registered');
  await page.getByLabel('Phone', { exact: true }).fill('+84 912 000 111');
  await page.getByRole('button', { name: 'Create Patient Account' }).click();
  const account = page.getByTestId('new-account');
  await expect(account).toContainText('Username: 0912000111');
  await page.getByRole('button', { name: 'Book an appointment' }).click();
  await expect(page.getByText('Selected: Browser Registered')).toBeVisible();

  await page.getByRole('button', { name: 'Select', exact: true }).first().click();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDate() === 1) await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: String(tomorrow.getDate()), exact: true }).first().click();
  await page.getByRole('button', { name: '10:30 AM', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Booking' }).click();
  await expect(page.getByText(/Booked Browser Registered/)).toBeVisible();
  await expect(page.getByRole('button', { name: '10:30 AM', exact: true })).toBeDisabled();

  // UC-10 (2a): số điện thoại đã đăng ký -> gợi ý mở hồ sơ cũ
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Duplicate Phone');
  await page.getByLabel('Phone', { exact: true }).fill('0912 000 111');
  await page.getByRole('button', { name: 'Create Patient Account' }).click();
  await expect(page.getByText(/already belongs to Browser Registered/)).toBeVisible();
});

test('mobile receptionist workspace fits viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'demo_reception');
  await expect(page).toHaveURL(/\/reception$/);
  await expect(page.getByRole('heading', { name: 'Patient Information' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('link', { name: 'Check-in' }).click();
  await expect(page.getByTestId('appointment-card').filter({ hasText: 'Dr. Jane Doe' })).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('reception-mobile.png'), fullPage: true });
});

test('role guard refuses patient access to receptionist workspace', async ({ page }) => {
  await login(page, 'demo_patient');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/reception');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('expired token can refresh and invalid old token does not block login', async ({ page }) => {
  await login(page, 'demo_patient');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.evaluate(() => sessionStorage.setItem('accessToken', 'expired-invalid-access'));
  await page.reload();
  await expect(page.getByRole('heading', { name: /Demo Patient/ })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).not.toBe('expired-invalid-access');
  await page.evaluate(() => sessionStorage.setItem('accessToken', 'another-expired-token'));
  await login(page, 'dr.jane');
  await expect(page).toHaveURL(/\/doctor\/dashboard$/);
});

test('patient can select doctor, date and available slot then book', async ({ page }) => {
  await login(page, 'demo_patient');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByText('Book Appointment', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Chọn bác sĩ và chuyên khoa' })).toBeVisible();
  const today = new Date();
  today.setDate(today.getDate() + 1);
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  // Calendar may display next-month dates; their full ISO title is unambiguous.
  await page.locator(`[title="${dateKey}"]`).first().click();
  await page.getByRole('button', { name: '09:30', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Appointments' })).toBeVisible();
});
