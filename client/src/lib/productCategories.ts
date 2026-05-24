export interface ProductSubcategory {
  id: string;
  label: string;
  sheetPatterns: RegExp[];
  modelPatterns: RegExp[];
}

export interface ProductCategory {
  id: string;
  label: string;
  icon?: string;
  sheetPatterns: RegExp[];
  subcategories?: ProductSubcategory[];
}

export type CategoryNavItem =
  | {
      type: "category";
      category: ProductCategory;
      matchedSheets: string[];
      totalCount: number;
    }
  | {
      type: "subcategory";
      category: ProductCategory;
      subcategory: ProductSubcategory;
      matchedSheets: string[];
      totalCount: number;
    };

const CATEGORIES: ProductCategory[] = [
  {
    id: "wired-network",
    label: "网络交换机",
    sheetPatterns: [
      /omniswitch\s+9900/i,
      /omniswitch\s+9500/i,
      /omniswitch\s+6920/i,
      /omniswitch\s+6900/i,
      /omniswitch\s+6870/i,
      /omniswitch\s+6865/i,
      /omniswitch\s+6860/i,
      /omniswitch\s+6575/i,
      /omniswitch\s+6570/i,
      /omniswitch\s+6560/i,
      /omniswitch\s+6465/i,
      /^OS6360$/i,
      /^OS2260\s+OS2360$/i,
      /国产化/i,
      /transceiver/i,
    ],
    subcategories: [
      {
        id: "wired-chassis",
        label: "插槽式",
        sheetPatterns: [/omniswitch\s+9900/i, /omniswitch\s+9500/i],
        modelPatterns: [/^OS(99\d\d|95\d\d)/i],
      },
      {
        id: "wired-box",
        label: "盒式",
        sheetPatterns: [
          /omniswitch\s+6920/i,
          /omniswitch\s+6900/i,
          /omniswitch\s+6870/i,
          /omniswitch\s+6860/i,
          /omniswitch\s+6570/i,
          /omniswitch\s+6560/i,
          /^OS6360$/i,
          /^OS2260\s+OS2360$/i,
        ],
        modelPatterns: [
          /^OS(69\d\d|6860|6870|6560|6570|6360|2260|2360)/i,
        ],
      },
      {
        id: "wired-industrial",
        label: "工业级",
        sheetPatterns: [
          /omniswitch\s+6865/i,
          /omniswitch\s+6575/i,
          /omniswitch\s+6465/i,
        ],
        modelPatterns: [/^OS(6865|6575|6465)/i],
      },
      {
        id: "wired-domestic",
        label: "国产化",
        sheetPatterns: [/国产化/i],
        modelPatterns: [/^OS(29\d\d|25\d\d|21\d\d)/i],
      },
      {
        id: "wired-transceiver",
        label: "光模块",
        sheetPatterns: [/transceiver/i],
        modelPatterns: [],
      },
    ],
  },
  {
    id: "wireless",
    label: "无线网络系统",
    sheetPatterns: [/omniaccess(?!.*esr)/i],
  },
  {
    id: "nms",
    label: "网管系统",
    sheetPatterns: [/omnivista(?!.*3600)/i],
  },
  {
    id: "security",
    label: "网络安全系统",
    sheetPatterns: [/esr/i],
  },
  {
    id: "pol",
    label: "无源光网络系统",
    sheetPatterns: [/OS9500\s+POL/i],
  },
  {
    id: "other",
    label: "其他产品",
    sheetPatterns: [
      /omniswitch\s+6450/i,
      /omniswitch\s+6350/i,
      /omniswitch\s+6250/i,
      /omniswitch\s+2220/i,
      /omnivista\s+3600/i,
    ],
  },
  {
    id: "service",
    label: "服务",
    sheetPatterns: [/^Service\s+and\s+Support$/i],
  },
  {
    id: "accessories",
    label: "配件",
    sheetPatterns: [/^Accessories$/i],
  },
];

const OTHER_CATEGORY: ProductCategory = {
  id: "other",
  label: "其他产品",
  sheetPatterns: [],
};

export function resolveCategoryForSheet(
  sheetName: string
): ProductCategory | undefined {
  return CATEGORIES.find(cat => cat.sheetPatterns.some(p => p.test(sheetName)));
}

export function buildCategoryNav(
  sheets: Array<{ sheetName: string; productCount: number }>
): CategoryNavItem[] {
  const navItems: CategoryNavItem[] = [];
  const assignedSheets = new Set<string>();

  for (const cat of CATEGORIES) {
    const matched = sheets.filter(s =>
      cat.sheetPatterns.some(p => p.test(s.sheetName))
    );
    if (matched.length === 0) continue;
    matched.forEach(s => assignedSheets.add(s.sheetName));

    const totalCount = matched.reduce((sum, s) => sum + s.productCount, 0);
    const matchedSheetNames = matched.map(s => s.sheetName);

    if (cat.subcategories && cat.subcategories.length > 0) {
      navItems.push({
        type: "category",
        category: cat,
        matchedSheets: matchedSheetNames,
        totalCount,
      });

      for (const sub of cat.subcategories) {
        const subMatched = sheets.filter(s =>
          sub.sheetPatterns.some(p => p.test(s.sheetName))
        );
        const subSheetNames = subMatched.map(s => s.sheetName);

        navItems.push({
          type: "subcategory",
          category: cat,
          subcategory: sub,
          matchedSheets: subSheetNames.length > 0 ? subSheetNames : matchedSheetNames,
          totalCount,
        });
      }
    } else {
      navItems.push({
        type: "category",
        category: cat,
        matchedSheets: matchedSheetNames,
        totalCount,
      });
    }
  }

  // "Other" category for unmatched sheets
  const unmatched = sheets.filter(s => !assignedSheets.has(s.sheetName));
  if (unmatched.length > 0) {
    const totalCount = unmatched.reduce((sum, s) => sum + s.productCount, 0);
    const matchedSheetNames = unmatched.map(s => s.sheetName);
    navItems.push({
      type: "category",
      category: OTHER_CATEGORY,
      matchedSheets: matchedSheetNames,
      totalCount,
    });
  }

  return navItems;
}

export function getQuerySheetNames(navItem: CategoryNavItem): string[] {
  return navItem.matchedSheets;
}

export function getModelFilter(navItem: CategoryNavItem): RegExp[] | undefined {
  if (navItem.type === "subcategory") {
    const patterns = navItem.subcategory.modelPatterns;
    return patterns.length > 0 ? patterns : undefined;
  }
  return undefined;
}

export function getAllCategories(): ProductCategory[] {
  return CATEGORIES;
}

export function getSheetsByCategory(
  sheets: Array<{ sheetName: string; productCount: number }>,
  categoryId: string
): Array<{ sheetName: string; productCount: number }> {
  const category = CATEGORIES.find(c => c.id === categoryId);
  if (!category) return [];
  return sheets.filter(s => category.sheetPatterns.some(p => p.test(s.sheetName)));
}

export function getSheetsBySubcategory(
  sheets: Array<{ sheetName: string; productCount: number }>,
  categoryId: string,
  subcategoryId: string
): Array<{ sheetName: string; productCount: number }> {
  const category = CATEGORIES.find(c => c.id === categoryId);
  if (!category?.subcategories) return [];
  const sub = category.subcategories.find(s => s.id === subcategoryId);
  if (!sub) return [];
  return sheets.filter(s => sub.sheetPatterns.some(p => p.test(s.sheetName)));
}
