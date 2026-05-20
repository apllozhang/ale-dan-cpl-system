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
 * 1. 网络交换机 - 子分类: 插槽式(9900/9500), 盒式(6920/6900/6870/6860/6570/6560/6360/2260/2360), 工业级(6865/6575/6465), 国产化(2960/2560/2160), 光模块(Transceivers)
 * 2. 无线网络系统 - OmniAccess Stellar WLAN, OmniAccess WLAN
 * 3. 网管系统 - OmniVista 2500 NMS
 * 4. 网络安全系统 - OmniAccess ESR
 * 5. 无源光网络系统 - OS9500 POL
 * 6. 其他产品 - OmniSwitch 6450, 6350, 6250, 2220, OmniVista 3600
 * 7. 服务 - Service and Support
 * 8. 配件 - Accessories
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
      /(?:omniswitch|os)\s*6360/i,
      /os\s*2260|os\s*2360/i,
      /国产化/i,
      /transceiver/i,
    ],
    subcategories: [
      {
        id: "wired-chassis",
        label: "插槽式",
        sheetPatterns: [/omniswitch\s*9900/i, /omniswitch\s*9500/i],
        modelPatterns: [/^OS\s*(9900|9500)/i],
      },
      {
        id: "wired-box",
        label: "盒式",
        sheetPatterns: [
          /omniswitch\s*6920/i,
          /omniswitch\s*6900/i,
          /omniswitch\s*6870/i,
          /omniswitch\s*6860/i,
          /omniswitch\s*6570/i,
          /omniswitch\s*6560/i,
          /os\s*6360/i,
          /os\s*2260|os\s*2360/i,
        ],
        modelPatterns: [/^OS\s*(6920|6900|6870|6860|6570|6560|6360|2260|2360)/i],
      },
      {
        id: "wired-industrial",
        label: "工业级",
        sheetPatterns: [/omniswitch\s*6865/i, /omniswitch\s*6575/i, /omniswitch\s*6465/i],
        modelPatterns: [/^OS\s*(6865|6575|6465)/i],
      },
      {
        id: "wired-domestic",
        label: "国产化",
        sheetPatterns: [/国产化/i, /os\s*2960/i, /os\s*2560/i, /os\s*2160/i],
        modelPatterns: [/^OS\s*(2960|2560|2160)/i],
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
 * Get sheets matching a specific subcategory's sheetPatterns
 */
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

/**
 * Export all categories for UI rendering
 */
export function getAllCategories(): ProductCategory[] {
  return CATEGORIES;
}
