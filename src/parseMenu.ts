import { parse } from 'date-fns';

export interface MenuItem {
  dayOfWeek: DayOfWeek;
  dateString: string;
  date: Date;
  servings: Serving[];
}

export interface Serving {
  mealType: MealType;
  menuType: MenuType;
  servingTitle: string;
  servingName: string;
  ingredients: string[];
  allergens: string[];
}

export type MenuItems = MenuItem[];

export type MealType = 'soup' | 'mainCourse';
export type MenuType = 'normal' | 'vege' | 'no-gluten' | 'no-milk' | 'no-egg';

export type DayOfWeek = 'poniedziałek' | 'wtorek' | 'środa' | 'czwartek' | 'piątek';

export function parseMenu(rawMenu: string[]) {
  const parsedMenu: MenuItems = [];
  let isItemCompleted = false;

  let menuItem: Partial<MenuItem> = {};
  const allergensMap = new Map<string, string>();

  for (let rawItem of rawMenu) {
    const item = rawItem.trim();

    if (item.length === 0) {
      continue;
    }

    const maybeDate = parse(item, 'dd.MM', new Date(Date.now()));

    if (isDayOfWeek(item)) {
      menuItem.dayOfWeek = item;
      continue;
    }

    if (maybeDate instanceof Date && !isNaN(maybeDate.valueOf())) {
      menuItem.date = maybeDate;
      menuItem.dateString = item;
      continue;
    }

    if (item.startsWith('zupa')) {
      let serving: Partial<Serving> = {};
      serving.mealType = 'soup';

      serving = { ...serving, ...parseServing(item) };

      if (!menuItem.servings) {
        menuItem.servings = [];
      }
      menuItem.servings?.push(serving as Serving);
      continue;
    }

    if (item.startsWith('drugie danie') || item.startsWith('II danie')) {
      let serving: Partial<Serving> = {};
      serving.mealType = 'mainCourse';

      serving = { ...serving, ...parseServing(item) };

      if (!menuItem.servings) {
        menuItem.servings = [];
      }
      menuItem.servings?.push(serving as Serving);
      isItemCompleted = true;
    }

    if (item.startsWith('Oznaczenia alergenów:')) {
      const index = item.indexOf(':');

      const listOfAllergens = item.slice(index + 1).trim();
      const allergensArray = listOfAllergens.split(',');

      for (let allergenInfo of allergensArray) {
        const [key, description] = allergenInfo.split('.').map(v => v.trim());
        allergensMap.set(key, description);
      }
    }

    if (isItemCompleted) {
      parsedMenu.push(menuItem as MenuItem);
      menuItem = {};
      isItemCompleted = false;
    }
  }

  return { parsedMenu, allergensMap };
}

function isDayOfWeek(item: string): item is DayOfWeek {
  switch (item) {
    case 'poniedziałek':
    case 'wtorek':
    case 'środa':
    case 'czwartek':
    case 'piątek':
      return true;
    default:
      return false;
  }
}

function parseServing(item: string): Partial<Serving> {
  const [servingTitle, restItem] = item?.split(':').map(v => v.trim());
  const [servingName, ...ingredientsWithAllergensUnparsed] = restItem
    ?.split(' - ')
    .map(v => v.trim());

  let ingredientsWithAllergensArr: string | undefined;
  let menuTypes: string | undefined;

  if (ingredientsWithAllergensUnparsed.length === 2) {
    [menuTypes, ingredientsWithAllergensArr] = ingredientsWithAllergensUnparsed;
  } else if (ingredientsWithAllergensUnparsed.length === 1) {
    ingredientsWithAllergensArr = ingredientsWithAllergensUnparsed[0];
  }

  let startOfAllergensIndex = ingredientsWithAllergensArr?.split('').lastIndexOf('(');

  let allergensStringUnparsed =
    !!startOfAllergensIndex && startOfAllergensIndex > -1
      ? ingredientsWithAllergensArr?.slice(startOfAllergensIndex)
      : '';

  const ingredientsString =
    !!startOfAllergensIndex && startOfAllergensIndex > -1
      ? ingredientsWithAllergensArr?.slice(0, startOfAllergensIndex)
      : ingredientsWithAllergensArr;

  const ingredients = ingredientsString?.split(', ').map(v => v.trim());

  let allergens: string[] = [];

  if (allergensStringUnparsed && allergensStringUnparsed.length > 0) {
    const start = allergensStringUnparsed.indexOf('(');
    const end = allergensStringUnparsed.indexOf(')');

    const allergensString = allergensStringUnparsed.slice(start + 1, end);
    allergens = allergensString
      ?.split(',')
      .filter(v => !isNaN(Number.parseInt(v)))
      .map(v => v.trim());
  }

  return {
    servingTitle,
    servingName: menuTypes ? `${servingName} - ${menuTypes}` : servingName,
    ingredients,
    allergens,
    menuType: getMealType(servingTitle),
  };
}

function getMealType(title: string): MenuType {
  if (title.includes('vege')) {
    return 'vege';
  }
  if (title.includes('bezgluten')) {
    return 'no-gluten';
  }
  if (title.includes('bezmleczn')) {
    return 'no-milk';
  }
  if (title.includes('bezjajeczn')) {
    return 'no-egg';
  }

  return 'normal';
}

export function extractIngredients(menu: MenuItems) {
  const ingredientsSet = new Set<string>();

  for (const menuItem of menu) {
    for (const servings of menuItem.servings) {
      for (const ingredient of servings.ingredients) {
        ingredientsSet.add(ingredient);
      }
    }
  }

  return ingredientsSet;
}
