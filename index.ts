import { chromium, devices, Page } from 'playwright';
import path from 'node:path';
import * as dotenv from 'dotenv';
import { Command } from 'commander';

import { parseMenu, extractIngredients, Serving, MenuItems } from './src/parseMenu';
import { readFile, saveFile, isExistingFile } from './src/utils';

const program = new Command('menuProcessor');

program
  .version('0.0.1')
  .requiredOption('-f, --filename <filename>', 'file to be processed', 'menu.txt')
  .option('-o, --output <filename>', 'Filename to save a processed menu', 'menu.json')
  .option('-i, --skipIngredients', 'skips checking of ingredients', 'false')
  .option('-r, --skipAddRecipies', 'skips adding recipies', 'false');

program.parse(process.argv);

const options = program.opts<{
  filename: string;
  output: string;
  skipIngredients: boolean;
  skipAddRecipies: boolean;
}>();

dotenv.config();

const email = process.env.ZP_LOGIN ?? '';
const password = process.env.ZP_PASS ?? '';
const baseURL = process.env.BASE_URL; //'https://aplikacja.zamowposilek.pl';

if (!baseURL) {
  throw new Error(`Base URL is missing. Check your env variable "BASE_URL"`);
}

const timestamp = Date.now();

const fileName = options.filename;
const outputFileName = options.output;
const skippedRecipieFilename = `skipped-recipies_${timestamp}.json`;

const filePath = path.join(__dirname, fileName);
const outputFilePath = path.join(__dirname, outputFileName);
const skippedRecipiesPath = path.join(__dirname, skippedRecipieFilename);

(async () => {
  let rawMenu: string[] = [];

  const isFileUnderMaybeFilePath = await isExistingFile(filePath);

  if (isFileUnderMaybeFilePath === false) {
    console.error(`The file "${fileName}" at path "${filePath}" does not exists`);
    process.exit();
  }

  try {
    console.log(`Reading file "${fileName}" at "${filePath}"`);
    rawMenu = await readFile(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}`, error);
    process.exit();
  }

  if (rawMenu.length === 0) {
    throw new Error('Menu file was not read correctly');
  }

  const menuData = parseMenu(rawMenu);
  const ingredients = extractIngredients(menuData.parsedMenu);

  const json = JSON.stringify({
    parsedMenu: menuData.parsedMenu,
    allergens: Array.from(menuData.allergensMap),
    ingredients: Array.from(ingredients),
  });

  await saveFile(outputFilePath, json);

  await runApp(menuData, ingredients);
})();

async function runApp(menuData: ReturnType<typeof parseMenu>, ingredients: Set<string>) {
  const skipIngredientsCheck = options.skipIngredients;
  const skipAddRecipies = options.skipAddRecipies;

  // preparation of browser
  const browser = await chromium.launch({ headless: false, slowMo: 200 });

  const device = devices['Desktop Edge HiDPI'];
  const context = await browser.newContext({
    ...device,
    screen: { width: 1920, height: 1080 },
    viewport: { width: 1920, height: 1080 },
    baseURL,
  });
  const page = await context.newPage();

  // main code
  await page.goto('/users/sign_in');

  await login(page);

  if (!skipIngredientsCheck) {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: ' Jadłospisy ' }).click();
    await page.getByRole('link', { name: ' Składniki' }).click();

    const notFoundIngredients = await addIngredients(page, ingredients);

    if (notFoundIngredients.size > 0) {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.getByRole('link', { name: ' Jadłospisy ' }).click();
      await page.getByRole('link', { name: ' Półprodukty' }).click();

      const notFoundSemiProducts = await addIngredients(page, notFoundIngredients, false);

      if (notFoundSemiProducts.size > 0) {
        console.log('Not found semiproducts:', Array.from(notFoundSemiProducts));
        console.log('Dodaj brakujące składniki do półproduktów');
        console.log('Zamykam skrypt');
        process.exit();
      }
    }
  }

  if (!skipAddRecipies) {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('link', { name: ' Jadłospisy ' }).click();
    await page.getByRole('link', { name: ' Przepisy' }).click();

    await addRecipies(page, menuData.parsedMenu);
  }

  // Teardown
  await page.close();
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

  for (const ingredient of serving.ingredients) {
    await page.getByRole('link', { name: ' Dodaj składnik' }).click();
    await page.getByRole('textbox', { name: 'Proszę wybrać składnik' }).click();

    await page.getByRole('searchbox').nth(1).fill(ingredient);

    const isEmptyList = await page.getByText('Brak wyników').count();

    if (!isEmptyList) {
      await page.getByRole('option', { name: ingredient, exact: true }).first().click();
    }
  }
  await page.getByRole('button', { name: 'Utwórz' }).click();
}

async function addIngredients(
  page: Page,
  ingredients: Set<string>,
  isSingleProduct: boolean = true,
) {
  const notFoundingredients = new Set<string>();

  for (const ingredient of ingredients) {
    if (isSingleProduct) {
      await page.getByPlaceholder('Wpisz nazwę składnika (min 3 znaki)').fill(ingredient);
    } else {
      await page.getByPlaceholder('Wpisz nazwę półproduktu (min 3 znaki)').fill(ingredient);
    }

    await page.getByRole('button', { name: 'Pokaż' }).click();
    await page.waitForLoadState('load');

    const row = await page
      .getByRole('row')
      .filter({ hasText: ingredient })
      .filter({ has: await page.locator('td').nth(1).getByText(ingredient, { exact: true }) });

    const rowsFoundCount = await row.count();

    if (rowsFoundCount === 0) {
      notFoundingredients.add(ingredient);
      continue;
    }

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
    }
  }

  return notFoundingredients;
}

async function addRecipies(page: Page, menu: MenuItems) {
  let totalItems = 0;
  let addedItems = 0;
  const skippedItems: Serving[] = [];

  for (const menuItem of menu) {
    for (const serving of menuItem.servings) {
      totalItems++;
      const servingExists = await menuItemExists(page, serving);
      if (servingExists === false) {
        await page.getByRole('link', { name: ' Dodaj przepis' }).click();
        await createRecipe(page, serving);
        addedItems++;
        continue;
      }
      skippedItems.push(serving);
    }
  }

  console.log('Summary of added serving');
  console.log(`Added: ${addedItems} of ${totalItems}`);

  const json = JSON.stringify({ addedItems, totalItems, skippedItems: skippedItems });

  await saveFile(skippedRecipiesPath, json);
}
