import { chromium, devices, Page } from 'playwright';
import path from 'node:path';
import * as dotenv from 'dotenv';

import { parseMenu, extractIngredients, Serving } from './src/parseMenu';
import { readFile, saveFile } from './src/utils';

dotenv.config();

const email = process.env.ZP_LOGIN ?? '';
const password = process.env.ZP_PASS ?? '';

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

  const menuData = parseMenu(rawMenu);
  const ingredients = extractIngredients(menuData.parsedMenu);

  // const json = JSON.stringify({
  //   parsedMenu: menuData.parsedMenu,
  //   allergens: Array.from(menuData.allergensMap),
  //   ingredients: Array.from(ingredients),
  // });

  // await saveFile(outputFile, json);

  await runApp(menuData, ingredients);
})();

async function runApp(menuData: ReturnType<typeof parseMenu>, ingredients: Set<string>) {
  // preparation of browser
  const browser = await chromium.launch({ headless: false, slowMo: 500 });

  const device = devices['Desktop Edge HiDPI'];
  const context = await browser.newContext({
    ...device,
    screen: { width: 1920, height: 1080 },
    viewport: { width: 1920, height: 1080 },
    baseURL: 'https://aplikacja.zamowposilek.pl',
  });
  const page = await context.newPage();

  // main code
  await page.goto('/users/sign_in');

  await login(page);

  await addIngredients(page, ingredients);

  // const serving = menuData.parsedMenu[0].servings[0];

  // const servingExists = await menuItemExists(page, serving);

  // if (servingExists === false) {
  //   await page.getByRole('link', { name: ' Dodaj przepis' }).click();
  //   await createRecipe(page, serving);
  // }

  // await page.pause();

  // Teardown
  await context.close();
  await browser.close();
}

async function login(page: Page) {
  await page.getByPlaceholder('Adres e-mail').fill(email);
  await page.getByPlaceholder('Hasło').fill(password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
}

async function menuItemExists(page: Page, serving: Serving) {
  await page.goto('/');
  await page.getByRole('link', { name: ' Jadłospisy ' }).click();
  await page.getByRole('link', { name: ' Przepisy' }).click();

  await page.getByPlaceholder('Wpisz nazwę przepisu (min 3 znaki)').fill(serving.servingName);
  await page.getByRole('button', { name: 'Szukaj' }).click();
  const cellsFound = await page.getByRole('cell', { name: '1', exact: true }).count();

  return cellsFound > 0;
}

async function createRecipe(page: Page, serving: Serving) {
  await page.getByLabel('* Nazwa').click();
  await page.getByLabel('* Nazwa').fill(serving.servingName);

  for (const [index, ingredient] of serving.ingredients.entries()) {
    await page.getByRole('link', { name: ' Dodaj składnik' }).click();
    await page.getByRole('textbox', { name: 'Proszę wybrać składnik' }).click();

    await page.getByRole('searchbox').nth(1).fill(ingredient);

    const isEmptyList = await page.getByText('Brak wyników').count();

    if (!isEmptyList) {
      await page.getByRole('option', { name: ingredient, exact: true }).click();
    }

    await page.pause();
  }
  await page.pause();

  // await page.getByRole('button', { name: 'Utwórz' }).click();
}

async function addIngredients(page: Page, ingredients: Set<string>) {
  await page.getByRole('link', { name: ' Jadłospisy ' }).click();
  // await page.getByRole('link', { name: ' Składniki' }).click();
  let foundItems = 0;
  let enabledItemsCount = 0;

  const notFoundElements = [];

  for (const ingredient of ingredients) {
    await page.getByRole('link', { name: ' Składniki' }).click();
    await page.getByPlaceholder('Wpisz nazwę składnika (min 3 znaki)').fill(ingredient);
    await page.getByRole('button', { name: 'Pokaż' }).click();

    const row = await page
      .getByRole('row', { name: ingredient })
      .filter({ has: page.locator('td').nth(1).getByText(ingredient, { exact: true }) });

    const rowsFoundCount = await row.count();

    if (rowsFoundCount === 0) {
      notFoundElements.push(ingredient);
      continue;
    }

    foundItems++;

    const element = await row.getByRole('checkbox', { includeHidden: true });

    const isChecked = await element.isChecked();

    if (!isChecked) {
      await await page
        .getByRole('row', { name: ingredient })
        .filter({ has: page.getByText(ingredient, { exact: true }) })
        .locator('td')
        .nth(3)
        .locator('span')
        .click();

      enabledItemsCount++;
    }
  }

  console.log({
    foundItems: foundItems,
    enabledItemsCount,
    allItemsCount: ingredients.size,
    notFoundElements,
  });
}
