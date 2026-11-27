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

test('patient search dropdown recommends patients and respects doctor scope', async ({ page }) => {
  await login(page, 'demo_reception');
  await expect(page).toHaveURL(/\/reception$/);
  await page.getByRole('button', { name: 'Gợi ý bệnh nhân' }).click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: 'Demo Patient' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Demo Patient' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Medical Browser Patient' })).toHaveCount(0);
  await page.getByPlaceholder('Tên, tài khoản, số điện thoại hoặc ID').fill('');
  await expect(page.getByRole('row').filter({ hasText: 'Medical Browser Patient' })).toHaveCount(1);
  await page.getByRole('navigation').getByRole('button', { name: 'Book Appointment', exact: true }).click();
  await page.getByRole('button', { name: 'Gợi ý bệnh nhân' }).click();
  await expect(page.locator('.ant-select-item-option-content').filter({ hasText: 'Demo Patient' })).toBeVisible();
  await page.getByRole('button', { name: 'Log Out' }).click();
  await login(page, 'dr.jane');
  await expect(page).toHaveURL(/\/doctor\/dashboard$/);
  await page.getByText('My Schedule', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Gợi ý bệnh nhân' }).click();
  await expect(page.locator('.ant-select-item-option-content').filter({ hasText: 'Demo Patient' })).toBeVisible();
  await expect(page.locator('.ant-select-item-option-content').filter({ hasText: 'Medical Browser Patient' })).toHaveCount(0);
});

test('reception checks in patient and doctor sees waiting patient', async ({ page }, testInfo) => {
  await login(page, 'demo_reception');
  await expect(page).toHaveURL(/\/reception$/);
  await expect(page.getByRole('cell', { name: 'Jane Doe', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reception-desktop.png'), fullPage: true });
  await page.getByRole('row').filter({ hasText: 'Demo Patient' }).getByRole('button', { name: 'Check-in', exact: true }).click();
  await expect(page.getByText('Chờ khám', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log Out' }).click();
  await login(page, 'dr.jane');
  await expect(page).toHaveURL(/\/doctor\/dashboard$/);
  await expect(page.getByRole('button', { name: 'Bắt đầu khám ngay' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('doctor-desktop.png'), fullPage: true });
});

test('reception can register a new patient through the form', async ({ page }) => {
  await login(page, 'demo_reception');
  await expect(page).toHaveURL(/\/reception$/);
  await page.getByRole('button', { name: 'Patient Registration', exact: true }).click();
  await page.getByRole('button', { name: 'Đăng ký bệnh nhân mới' }).click();
  await page.getByLabel('Họ và tên', { exact: true }).fill('Browser Registered');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('browser_registered');
  await page.getByLabel('Email bệnh nhân', { exact: true }).fill('browser_registered@example.com');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Browser Registered', exact: true })).toBeVisible();
  const patientCode = await page.getByRole('row').filter({ hasText: 'Browser Registered' }).getByRole('cell').first().innerText();
  await page.getByRole('navigation').getByRole('button', { name: 'Book Appointment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng ký bệnh nhân mới' })).toHaveCount(0);
  const search = page.getByPlaceholder('ID, tên, tài khoản, SĐT hoặc địa chỉ');
  await expect(search).toHaveCount(1);
  const results = page.waitForResponse((response) => response.url().includes('/reception/patients/?search=')
    && new URL(response.url()).searchParams.get('search') === patientCode && response.status() === 200);
  await search.fill(patientCode);
  const patients = await (await results).json();
  expect(patients.map((patient) => patient.username)).toEqual(['browser_registered']);
  await page.locator('.ant-select-item-option-content').filter({ hasText: 'Browser Registered' }).click();
  await expect(search).toHaveValue(new RegExp(patientCode));
  await expect(page.getByRole('heading', { name: 'Chọn bác sĩ và chuyên khoa' })).toBeVisible();
  await search.fill('');
  await expect(page.getByRole('heading', { name: 'Chọn bác sĩ và chuyên khoa' })).toHaveCount(0);
});

test('mobile receptionist workspace fits viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'demo_reception');
  await expect(page).toHaveURL(/\/reception$/);
  await expect(page.getByRole('heading', { name: 'Lịch hẹn & Check-in' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Jane Doe', exact: true })).toBeAttached();
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

test('medical records flow from reception check-in to doctor and patient', async ({ page, context }, testInfo) => {
  await login(page, 'demo_reception');
  await expect(page).toHaveURL(/\/reception$/);
  const row = page.getByRole('row').filter({ hasText: 'Medical Browser Patient' });
  await row.getByRole('button', { name: 'Check-in', exact: true }).click();
  await expect(row.getByText('Chờ khám', { exact: true })).toBeVisible();

  const doctor = await context.newPage();
  await login(doctor, 'dr.marcus');
  await expect(doctor).toHaveURL(/\/doctor\/dashboard$/);
  await doctor.getByText('My Schedule', { exact: true }).first().click();
  await doctor.getByRole('row').filter({ hasText: 'Medical Browser Patient' }).getByRole('button', { name: 'Khám bệnh', exact: true }).click();
  const exam = doctor.getByRole('dialog');
  await exam.getByPlaceholder('Nhập kết luận chẩn đoán của bác sĩ...').fill('Browser test diagnosis');
  await exam.getByPlaceholder('Tên thuốc (VD: Paracetamol 500mg)').fill('Browser test medicine');
  await exam.getByPlaceholder('Liều lượng (VD: 1 viên x 3)').fill('Test dosage');
  await exam.getByPlaceholder('Cách dùng (VD: Sau ăn)').fill('Test instructions');
  await exam.getByPlaceholder('Chế độ ăn uống, sinh hoạt, lịch tái khám...').fill('Browser follow-up notes');
  await exam.getByRole('button', { name: 'Hoàn thành khám & Lưu bệnh án' }).click();
  await expect(exam).toHaveCount(0);
  await doctor.getByText('Medical Records', { exact: true }).first().click();
  await expect(doctor.getByText('Browser test diagnosis', { exact: false })).toBeVisible();
  await doctor.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  await expect(doctor.getByRole('dialog').getByText('Browser test medicine', { exact: true })).toBeVisible();
  await doctor.screenshot({ path: testInfo.outputPath('doctor-medical-record.png'), fullPage: true, animations: 'disabled' });

  const patient = await context.newPage();
  await login(patient, 'demo_medical');
  await expect(patient).toHaveURL(/\/dashboard$/);
  await expect(patient.getByRole('cell', { name: 'Browser test diagnosis', exact: true })).toBeVisible();
  await patient.getByText('Medical Records', { exact: true }).first().click();
  await patient.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  const detail = patient.getByRole('dialog');
  await expect(detail.getByText('Browser test medicine', { exact: true })).toBeVisible();
  await expect(detail.getByText('Test dosage', { exact: true })).toBeVisible();
  await expect(detail.getByText('Browser follow-up notes', { exact: true })).toBeVisible();
  await patient.screenshot({ path: testInfo.outputPath('patient-medical-record.png'), fullPage: true, animations: 'disabled' });
  await patient.evaluate(() => document.body.classList.add('printing-record'));
  await patient.pdf({ path: testInfo.outputPath('patient-medical-record.pdf'), format: 'A4' });
  await patient.evaluate(() => document.body.classList.remove('printing-record'));
  await detail.getByRole('button', { name: 'Đóng', exact: true }).click();
  await patient.getByText('My Appointments', { exact: true }).first().click();
  await patient.getByRole('button', { name: 'Completed', exact: true }).click();
  await patient.getByRole('button', { name: 'Xem bệnh án', exact: true }).click();
  await expect(patient.getByRole('dialog').getByText('Browser test diagnosis', { exact: true })).toBeVisible();
});
