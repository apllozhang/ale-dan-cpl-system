export interface ProductSubcategory {
  id: string;
  label: string;
  sheetPatterns: RegExp[];
  modelPatterns: RegExp[];
}

export interface ProductCategory {
  id: string;
  label: string;
  sheetPatterns: RegExp[];
  subcategories?: ProductSubcategory[];
}

export type CategoryNavItem =
  | { type: "category"; category: ProductCategory; matchedSheets: string[]; totalCount: number }
  | { type: "subcategory"; category: ProductCategory; subcategory: ProductSubcategory; matchedSheets: string[]; totalCount: number };

const CATEGORIES: ProductCategory[] = [
  {
    id: "wired",
    label: "有线网络系统",
    sheetPatterns: [/omniswitch/i],
    subcategories: [
      {
        id: "wired-core",
        label: "核心层交换机",
        sheetPatterns: [/omniswitch/i],
        modelPatterns: [/^OS\s*(9900|10K|6900)/i],
      },
      {
        id: "wired-aggregation",
        label: "汇聚层交换机",
        sheetPatterns: [/omniswitch/i],
        modelPatterns: [/^OS\s*(6860|6465[^T]|6450)/i],
      },
      {
        id: "wired-access",
        label: "接入层交换机",
        sheetPatterns: [/omniswitch/i],
        modelPatterns: [/^OS\s*(6360|6350|6465T)/i],
      },
    ],
  },
  {
    id: "wireless",
    label: "无线网络系统",
    sheetPatterns: [/stellar|wlan|wireless/i],
  },
  {
    id: "nms",
    label: "网管系统",
    sheetPatterns: [/omnivista|nms/i],
  },
  {
    id: "security",
    label: "网络安全系统",
    sheetPatterns: [/esr/i],
  },
  {
    id: "pol",
    label: "无源光网络系统",
    sheetPatterns: [/os9500|pol|passive/i],
  },
];

const OTHER_CATEGORY: ProductCategory = {
  id: "other",
  label: "其他产品",
  sheetPatterns: [],
};

export function resolveCategoryForSheet(sheetName: string): ProductCategory | undefined {
  return CATEGORIES.find(cat => cat.sheetPatterns.some(p => p.test(sheetName)));
}

export function buildCategoryNav(
  sheets: Array<{ sheetName: string; productCount: number }>
): CategoryNavItem[] {
  const navItems: CategoryNavItem[] = [];
  const assignedSheets = new Set<string>();

  for (const cat of CATEGORIES) {
    const matched = sheets.filter(s => cat.sheetPatterns.some(p => p.test(s.sheetName)));
    if (matched.length === 0) continue;
    matched.forEach(s => assignedSheets.add(s.sheetName));

    const totalCount = matched.reduce((sum, s) => sum + s.productCount, 0);
    const matchedSheetNames = matched.map(s => s.sheetName);

    if (cat.subcategories && cat.subcategories.length > 0) {
      // Category with subcategories
      navItems.push({ type: "category", category: cat, matchedSheets: matchedSheetNames, totalCount });

      for (const sub of cat.subcategories) {
        navItems.push({ type: "subcategory", category: cat, subcategory: sub, matchedSheets: matchedSheetNames, totalCount });
      }
    } else {
      navItems.push({ type: "category", category: cat, matchedSheets: matchedSheetNames, totalCount });
    }
  }

  // "Other" category for unmatched sheets
  const unmatched = sheets.filter(s => !assignedSheets.has(s.sheetName));
  if (unmatched.length > 0) {
    const totalCount = unmatched.reduce((sum, s) => sum + s.productCount, 0);
    const matchedSheetNames = unmatched.map(s => s.sheetName);
    navItems.push({ type: "category", category: OTHER_CATEGORY, matchedSheets: matchedSheetNames, totalCount });
  }

  return navItems;
}

export function getQuerySheetName(navItem: CategoryNavItem): string | undefined {
  return navItem.matchedSheets[0];
}

export function getModelFilter(navItem: CategoryNavItem): RegExp[] | undefined {
  if (navItem.type === "subcategory") {
    return navItem.subcategory.modelPatterns;
  }
  return undefined;
}
