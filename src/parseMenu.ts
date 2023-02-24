export interface MenuItem {
  dayOfWeek: DayOfWeek;
  dateString: string;
  date: Date;
  servings: Serving[];
}

export interface Serving {
  mealType: MealType;
  menuType: MenuType;
  title: string;
  name: string;
  ingredients: string[];
}

export type MenuItems = MenuItem[];

export type MealType = 'soup' | 'mainCourse';
export type MenuType = 'normal' | 'vege' | 'no-gluten' | 'no-milk' | 'no-egg';

export type DayOfWeek = 'poniedziałek' | 'wtorek' | 'środa' | 'czwartek' | 'piątek';

export function parseMenu(rawMenu: string[]) {
  const parsedMenu: MenuItems = [];
  let isItemCompleted = false;

  let menuItem: Partial<MenuItem> = {};

  for (let rawItem of rawMenu) {
    const item = rawItem.trim();
    if (isDayOfWeek(item)) {
      menuItem.dayOfWeek = item;
      continue;
    }

    if (item.startsWith('zupa')) {
      const serving: Partial<Serving> = {};
      serving.mealType = 'soup';

      if (!menuItem.servings) {
        menuItem.servings = [];
      }
      menuItem.servings?.push(serving as Serving);
      continue;
    }

    if (item.startsWith('drugie danie') || item.startsWith('II danie')) {
      const serving: Partial<Serving> = {};
      serving.mealType = 'mainCourse';

      if (!menuItem.servings) {
        menuItem.servings = [];
      }
      menuItem.servings?.push(serving as Serving);
      isItemCompleted = true;
    }

    if (isItemCompleted) {
      parsedMenu.push(menuItem as MenuItem);
      menuItem = {};
      isItemCompleted = false;
    }
  }

  return parsedMenu;
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
