import { chromium, devices } from 'playwright';

async function runApp() {
  // preparation of browser
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // main code

  await page.goto('http://www.wp.pl');

  await page.pause();

  // Teardown
  await context.close();
  await browser.close();
}

runApp();
