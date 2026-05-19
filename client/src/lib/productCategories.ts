/**
 * Enhanced product categories structure
 * Groups 27 product series into 8 main categories for better organization
 */

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
  | { type: "category"; category: ProductCategory; matchedSheets: string[]; totalCount: number }
  | { type: "subcategory"; category: ProductCategory; subcategory: ProductSubcategory; matchedSheets: string[]; totalCount: number };

/**
 * 8 Main Categories:
 * 1. 网络交换机 (12 series) - OmniSwitch 9900, 9500, 6920, 6900, 6870, 6865, 6860, 6575, 6570, 6560, 6465, 6360, 6350, 6250, 2260/2360, 国产化, Transceivers
 * 2. 无线网络系统 (2 series) - OmniAccess Stellar WLAN, OmniAccess WLAN
 * 3. 网管系统 (1 series) - OmniVista 2500 NMS
 * 4. 网络安全系统 (1 series) - OmniAccess ESR
 * 5. 无源光网络系统 (1 series) - OS9500 POL
 * 6. 其他产品 (4 series) - OmniSwitch 6450, 6350, 6250, 2220, OmniVista 3600
 * 7. 服务 (1 series) - Service and Support
 * 8. 配件 (1 series) - Accessories
 */

const CATEGORIES: ProductCategory[] = [
  {
    id: "wired-network",
    label: "网络交换机",
    icon: "🔌",
    sheetPatterns: [
      /omniswitch\s*9900/i,
      /omniswitch\s*9500/i,
      /omniswitch\s*6920/i,
      /omniswitch\s*6900/i,
      /omniswitch\s*6870/i,
      /omniswitch\s*6865/i,
      /omniswitch\s*6860/i,
      /omniswitch\s*6575/i,
      /omniswitch\s*6570/i,
      /omniswitch\s*6560/i,
      /omniswitch\s*6465/i,
      /omniswitch\s*6360/i,
      /os\s*2260|os\s*2360/i,
      /国产化\s*os|国产化\s*os2960|国产化\s*os2560|国产化\s*os2160/i,
      /transceiver/i,
    ],
    subcategories: [
      {
        id: "wired-core",
        label: "核心层交换机",
        sheetPatterns: [/omniswitch\s*9900/i, /omniswitch\s*9500/i],
        modelPatterns: [/^OS\s*(9900|9500|10K)/i],
      },
      {
        id: "wired-aggregation",
        label: "汇聚层交换机",
        sheetPatterns: [/omniswitch\s*6[0-9]{3}/i],
        modelPatterns: [/^OS\s*(6900|6870|6865|6860|6575|6570|6560|6465[^T])/i],
      },
      {
        id: "wired-access",
        label: "接入层交换机",
        sheetPatterns: [/omniswitch\s*6[0-9]{3}/i],
        modelPatterns: [/^OS\s*(6360|6350|6250|6465T|2260|2360|2220)/i],
      },
    ],
  },
  {
    id: "wireless",
    label: "无线网络系统",
    icon: "📡",
    sheetPatterns: [/stellar|wlan|wireless|ominiaccss.*wlan/i],
  },
  {
    id: "nms",
    label: "网管系统",
    icon: "📊",
    sheetPatterns: [/omnivista\s*2500|nms/i],
  },
  {
    id: "security",
    label: "网络安全系统",
    icon: "🔒",
    sheetPatterns: [/esr|ominiaccss.*esr/i],
  },
  {
    id: "pol",
    label: "无源光网络系统",
    icon: "💡",
    sheetPatterns: [/os9500\s*pol|pol|passive\s*optical/i],
  },
  {
    id: "other",
    label: "其他产品",
    icon: "📦",
    sheetPatterns: [
      /omniswitch\s*6450/i,
      /omniswitch\s*6350/i,
      /omniswitch\s*6250/i,
      /omniswitch\s*2220/i,
      /omnivista\s*3600/i,
    ],
  },
  {
    id: "service",
    label: "服务",
    icon: "🛠️",
    sheetPatterns: [/service|support/i],
  },
  {
    id: "accessories",
    label: "配件",
    icon: "🔧",
    sheetPatterns: [/accessories|accessory/i],
  },
];

/**
 * Resolve which category a sheet belongs to
 */
export function resolveCategoryForSheet(sheetName: string): ProductCategory | undefined {
  return CATEGORIES.find(cat => cat.sheetPatterns.some(p => p.test(sheetName)));
}

/**
 * Build category navigation items from available sheets
 */
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
      // Category with subcategories - add main category first
      navItems.push({ 
        type: "category", 
        category: cat, 
        matchedSheets: matchedSheetNames, 
        totalCount 
      });

      // Then add subcategories
      for (const sub of cat.subcategories) {
        navItems.push({ 
          type: "subcategory", 
          category: cat, 
          subcategory: sub, 
          matchedSheets: matchedSheetNames, 
          totalCount 
        });
      }
    } else {
      // Simple category without subcategories
      navItems.push({ 
        type: "category", 
        category: cat, 
        matchedSheets: matchedSheetNames, 
        totalCount 
      });
    }
  }

  return navItems;
}

/**
 * Get the first sheet name from a category navigation item
 */
export function getQuerySheetName(navItem: CategoryNavItem): string | undefined {
  return navItem.matchedSheets[0];
}

/**
 * Get model filter patterns for a navigation item (used for subcategories)
 */
export function getModelFilter(navItem: CategoryNavItem): RegExp[] | undefined {
  if (navItem.type === "subcategory") {
    return navItem.subcategory.modelPatterns;
  }
  return undefined;
}

/**
 * Get all sheets that match a category
 */
export function getSheetsByCategory(
  sheets: Array<{ sheetName: string; productCount: number }>,
  categoryId: string
): Array<{ sheetName: string; productCount: number }> {
  const category = CATEGORIES.find(c => c.id === categoryId);
  if (!category) return [];
  
  return sheets.filter(s => category.sheetPatterns.some(p => p.test(s.sheetName)));
}

/**
 * Export all categories for UI rendering
 */
export function getAllCategories(): ProductCategory[] {
  return CATEGORIES;
}
