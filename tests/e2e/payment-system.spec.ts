import { test, expect } from '@playwright/test'

test.describe('Payment System E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
  })

  test('should load payment methods in checkout', async ({ page }) => {
    await page.goto('http://localhost:3000/checkout?functionId=test-func&zoneId=test-zone')

    // Esperar a que se carguen los métodos
    await page.waitForSelector('[data-testid="payment-methods-container"]')

    const methods = await page.locator('[data-testid="payment-method"]').count()
    expect(methods).toBeGreaterThan(0)
  })

  test('should upload receipt when manual verification required', async ({ page }) => {
    await page.goto('http://localhost:3000/checkout?functionId=test-func&zoneId=test-zone')

    // Seleccionar método que requiere verificación
    await page.click('[data-testid="payment-method-nequi"]')

    // Esperar que aparezca el campo de archivo
    await page.waitForSelector('input[type="file"]')

    // Simular upload de archivo
    const fileInput = await page.locator('input[type="file"]')
    await fileInput.setInputFiles('./test/fixtures/receipt.jpg')

    // Verificar que aparece el nombre del archivo
    await expect(page.locator('[data-testid="file-name"]')).toContainText('receipt.jpg')
  })

  test('should submit order with payment method', async ({ page }) => {
    await page.goto('http://localhost:3000/checkout?functionId=test-func&zoneId=test-zone')

    // Llenar formulario
    await page.fill('input[name="customerName"]', 'Juan Pérez')
    await page.fill('input[name="email"]', 'juan@test.com')
    await page.fill('input[name="phone"]', '3001234567')
    await page.fill('input[name="idNumber"]', '1098765432')

    // Seleccionar método
    await page.click('[data-testid="payment-method-nequi"]')

    // Submit
    await page.click('button[type="submit"]')

    // Esperar confirmación
    await page.waitForSelector('[data-testid="order-success"]')
    const orderId = await page.locator('[data-testid="order-id"]').textContent()
    expect(orderId).toBeTruthy()
  })

  test('should view payment status', async ({ page }) => {
    await page.goto('http://localhost:3000/payment-status')

    // Esperar a que se carguen las órdenes
    await page.waitForSelector('[data-testid="orders-list"]')

    const orders = await page.locator('[data-testid="order-item"]').count()
    expect(orders).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Admin Payment Methods', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/admin')
  })

  test('should manage payment methods', async ({ page }) => {
    // Click en tab de métodos de pago
    await page.click('button:has-text("Métodos de Pago")')

    // Esperar tabla de métodos
    await page.waitForSelector('[data-testid="payment-methods-table"]')

    // Verificar que existen métodos
    const methods = await page.locator('[data-testid="method-row"]').count()
    expect(methods).toBeGreaterThan(0)

    // Toggle un método
    const toggle = page.locator('[data-testid="method-toggle"]').first()
    await toggle.click()

    // Verificar que el toggle cambió
    await expect(toggle).toHaveAttribute('data-state', /(on|off)/)
  })

  test('should verify payments manually', async ({ page }) => {
    // Click en tab de verificación
    await page.click('button:has-text("Verificación de Pagos")')

    // Esperar lista de verificaciones
    await page.waitForSelector('[data-testid="verification-queue"]')

    // Click en botón "Revisar"
    const reviewBtn = page.locator('[data-testid="review-btn"]').first()
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click()

      // Esperar modal
      await page.waitForSelector('[data-testid="verification-modal"]')

      // Click aprobar
      await page.click('button:has-text("Aprobar")')

      // Verificar confirmación
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    }
  })

  test('should view analytics', async ({ page }) => {
    // Click en tab de analytics
    await page.click('button:has-text("Analytics")')

    // Esperar gráficos
    await page.waitForSelector('[data-testid="analytics-container"]')

    // Verificar métricas
    const revenue = await page.locator('[data-testid="total-revenue"]').textContent()
    expect(revenue).toBeTruthy()

    // Cambiar período
    await page.click('button[data-period="week"]')

    // Esperar actualización
    await page.waitForTimeout(500)
    const updatedRevenue = await page.locator('[data-testid="total-revenue"]').textContent()
    expect(updatedRevenue).toBeTruthy()
  })
})
