import { chromium, devices } from 'playwright';
import path from 'node:path';

import { parseMenu } from './src/parseMenu';
import { readFile, saveFile } from './src/utils';

const fileName = 'menu.txt';

const filePath = path.join(__dirname, fileName);

const outputFile = path.join(__dirname, 'menu.json');

(async () => {
  let rawMenu: string[] = [];

  try {
    rawMenu = await readFile(filePath);
  } catch (error) {
    console.error(error);
  }

  if (rawMenu.length === 0) {
    throw new Error('Menu file was not read correctly');
  }

  const { parsedMenu, allergensMap } = parseMenu(rawMenu);

  const allergens = Array.from(allergensMap);

  const json = JSON.stringify({ parsedMenu, allergens });

  await saveFile(outputFile, json);

  // await runApp();
})();

async function runApp() {
  // preparation of browser
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });

  const device = devices['Desktop Edge HiDPI'];
  const context = await browser.newContext({
    ...device,
    screen: { width: 1920, height: 1080 },
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // main code

  await page.goto('http://www.wp.pl');

  await page.pause();

  // Teardown
  await context.close();
  await browser.close();
}
