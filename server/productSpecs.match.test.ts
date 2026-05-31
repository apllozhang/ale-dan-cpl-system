import { describe, it, expect } from "vitest";
import { collectSpecKeys } from "@shared/utils";

// Pure matching functions extracted for testing
function normalizeForMatch(model: string) {
  const trimmed = model.trim();
  return {
    exact: trimmed,
    lower: trimmed.toLowerCase(),
    noSpace: trimmed.replace(/\s/g, ""),
  };
}

type SpecEntry = { productModel: string; specs: Record<string, string> };

function matchItem(itemModel: string, specEntries: SpecEntry[]): SpecEntry | null {
  const l1Map = new Map<string, SpecEntry>();
  const l2Map = new Map<string, SpecEntry>();
  const l3Map = new Map<string, SpecEntry>();

  for (const entry of specEntries) {
    const norm = normalizeForMatch(entry.productModel);
    l1Map.set(norm.exact, entry);
    l2Map.set(norm.lower, entry);
    l3Map.set(norm.noSpace, entry);
  }

  // Prefix matching (longest prefix wins, min 2 chars)
  function findByPrefix(model: string): SpecEntry | null {
    const lower = model.trim().toLowerCase();
    let best: SpecEntry | null = null;
    let bestLen = 0;
    for (const entry of specEntries) {
      const entryLower = entry.productModel.trim().toLowerCase();
      if (entryLower.length >= 2 && lower.startsWith(entryLower) && entryLower.length > bestLen) {
        best = entry;
        bestLen = entryLower.length;
      }
    }
    return best;
  }

  const norm = normalizeForMatch(itemModel);
  const exact = l1Map.get(norm.exact) ?? l2Map.get(norm.lower) ?? l3Map.get(norm.noSpace);
  if (exact) return exact;

  const lower = norm.lower;
  // L4: item starts with spec entry
  let best: SpecEntry | null = findByPrefix(itemModel);
  if (best) return best;

  // L5: spec entry starts with item (reverse prefix)
  let bestLen = 0;
  for (const entry of specEntries) {
    const entryLower = entry.productModel.trim().toLowerCase();
    if (lower.length >= 2 && entryLower.startsWith(lower) && entryLower.length > bestLen) {
      best = entry;
      bestLen = entryLower.length;
    }
  }
  return best;
}

describe("Spec matching logic", () => {
  const specs: SpecEntry[] = [
    { productModel: "AP-1234", specs: { "频率": "2.4GHz", "功率": "20dBm" } },
    { productModel: "SW-5678", specs: { "端口数": "48", "速率": "10G" } },
    { productModel: "CABLE - CAT6", specs: { "长度": "1m", "类型": "CAT6" } },
  ];

  it("exact trim match: leading/trailing spaces are trimmed", () => {
    const result = matchItem(" AP-1234 ", specs);
    expect(result).not.toBeNull();
    expect(result!.specs).toEqual({ "频率": "2.4GHz", "功率": "20dBm" });
  });

  it("case insensitive match: lowercase input matches uppercase spec", () => {
    const result = matchItem("ap-1234", specs);
    expect(result).not.toBeNull();
    expect(result!.specs).toEqual({ "频率": "2.4GHz", "功率": "20dBm" });
  });

  it("case insensitive match: mixed case input", () => {
    const result = matchItem("Ap-1234", specs);
    expect(result).not.toBeNull();
    expect(result!.specs).toEqual({ "频率": "2.4GHz", "功率": "20dBm" });
  });

  it("space insensitive match: spaces removed from input", () => {
    const result = matchItem("CABLE-CAT6", specs);
    expect(result).not.toBeNull();
    expect(result!.specs).toEqual({ "长度": "1m", "类型": "CAT6" });
  });

  it("no match returns null", () => {
    expect(matchItem("XYZ-9999", specs)).toBeNull();
  });

  it("empty string returns null", () => {
    expect(matchItem("", specs)).toBeNull();
  });

  it("whitespace-only input returns null", () => {
    expect(matchItem("   ", specs)).toBeNull();
  });

  it("exact match takes priority over case-insensitive", () => {
    const conflictSpecs: SpecEntry[] = [
      { productModel: "AP-1234", specs: { "v": "upper" } },
      { productModel: "ap-1234", specs: { "v": "lower" } },
    ];
    // Input "AP-1234" should match exact trim "AP-1234"
    const r1 = matchItem("AP-1234", conflictSpecs);
    expect(r1).not.toBeNull();
    expect(r1!.specs).toEqual({ "v": "upper" });

    // Input "ap-1234" should match exact trim "ap-1234"
    const r2 = matchItem("ap-1234", conflictSpecs);
    expect(r2).not.toBeNull();
    expect(r2!.specs).toEqual({ "v": "lower" });
  });
});

describe("Prefix matching for slot-based switches", () => {
  const chassisSpecs: SpecEntry[] = [
    { productModel: "9907", specs: { "交换容量": "6.4Tbps", "插槽数": "7" } },
    { productModel: "9912", specs: { "交换容量": "12.8Tbps", "插槽数": "12" } },
    { productModel: "9503", specs: { "交换容量": "3.2Tbps", "插槽数": "3" } },
    { productModel: "9506", specs: { "交换容量": "6.4Tbps", "插槽数": "6" } },
  ];

  it("9907-E-AC matches 9907 via prefix", () => {
    const result = matchItem("9907-E-AC", chassisSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("9907");
    expect(result!.specs["插槽数"]).toBe("7");
  });

  it("9912-E-DC matches 9912 via prefix", () => {
    const result = matchItem("9912-E-DC", chassisSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("9912");
    expect(result!.specs["插槽数"]).toBe("12");
  });

  it("9503-E-AC matches 9503 via prefix", () => {
    const result = matchItem("9503-E-AC", chassisSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("9503");
    expect(result!.specs["插槽数"]).toBe("3");
  });

  it("9506-E-AC matches 9506 via prefix", () => {
    const result = matchItem("9506-E-AC", chassisSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("9506");
    expect(result!.specs["插槽数"]).toBe("6");
  });

  it("longest prefix wins when multiple prefixes match", () => {
    const multiPrefix: SpecEntry[] = [
      { productModel: "9907", specs: { "v": "base" } },
      { productModel: "9907-E", specs: { "v": "e-module" } },
    ];
    // "9907-E-AC" matches "9907-E" (longer) not "9907"
    const result = matchItem("9907-E-AC", multiPrefix);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("9907-E");
    expect(result!.specs["v"]).toBe("e-module");
  });

  it("prefix with 2 chars matches (ESR chassis F5 pattern)", () => {
    const shortPrefix: SpecEntry[] = [
      { productModel: "99", specs: { "v": "short" } },
    ];
    const result = matchItem("9907-E-AC", shortPrefix);
    expect(result).not.toBeNull();
    expect(result!.specs["v"]).toBe("short");
  });

  it("prefix match is case-insensitive", () => {
    const mixedCase: SpecEntry[] = [
      { productModel: "9907", specs: { "v": "upper" } },
    ];
    const result = matchItem("9907-E-ac", mixedCase);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("9907");
  });
});

describe("normalizeForMatch", () => {
  it("trims leading/trailing spaces", () => {
    expect(normalizeForMatch(" AP-1234 ").exact).toBe("AP-1234");
  });

  it("converts to lowercase", () => {
    expect(normalizeForMatch("AP-1234").lower).toBe("ap-1234");
  });

  it("removes all spaces", () => {
    expect(normalizeForMatch("CABLE - CAT6").noSpace).toBe("CABLE-CAT6");
  });

  it("handles empty string", () => {
    expect(normalizeForMatch("").exact).toBe("");
    expect(normalizeForMatch("").lower).toBe("");
    expect(normalizeForMatch("").noSpace).toBe("");
  });
});

describe("collectSpecKeys", () => {
  it("returns empty array for empty input", () => {
    expect(collectSpecKeys([])).toEqual([]);
  });

  it("collects unique keys across all matched items", () => {
    const matched = [
      { specs: { a: "1", b: "2" } },
      { specs: { b: "3", c: "4" } },
    ];
    const keys = collectSpecKeys(matched);
    expect(keys).toContain("a");
    expect(keys).toContain("b");
    expect(keys).toContain("c");
    expect(keys.length).toBe(3);
  });

  it("handles items with no specs", () => {
    const matched = [
      { specs: { a: "1" } },
      { specs: {} },
    ];
    expect(collectSpecKeys(matched)).toEqual(["a"]);
  });
});

describe("Reverse prefix matching (L5)", () => {
  const moduleSpecs: SpecEntry[] = [
    { productModel: "9907-E-AC", specs: { "电源": "AC", "插槽": "E系列" } },
    { productModel: "9907-E-DC", specs: { "电源": "DC", "插槽": "E系列" } },
    { productModel: "9907-X-AC", specs: { "电源": "AC", "插槽": "X系列" } },
  ];

  it("short item model matches spec entry starting with it", () => {
    const result = matchItem("9907-E", moduleSpecs);
    expect(result).not.toBeNull();
    // Should match "9907-E-AC" or "9907-E-DC" (both start with "9907-E")
    expect(["9907-E-AC", "9907-E-DC"]).toContain(result!.productModel);
  });

  it("full chassis model matches exact spec first (L1 takes priority over L5)", () => {
    const result = matchItem("9907-E-AC", moduleSpecs);
    expect(result).not.toBeNull();
    expect(result!.specs["电源"]).toBe("AC");
  });

  it("item shorter than 2 chars does not trigger L5", () => {
    const shortSpecs: SpecEntry[] = [
      { productModel: "ABC-XYZ", specs: { "v": "long" } },
    ];
    expect(matchItem("A", shortSpecs)).toBeNull();
  });

  it("L5 is case-insensitive", () => {
    const result = matchItem("9907-e", moduleSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("9907-E-AC");
  });

  it("L4 takes priority over L5 (forward prefix preferred)", () => {
    const mixedSpecs: SpecEntry[] = [
      { productModel: "9907", specs: { "v": "chassis" } },
      { productModel: "9907-E", specs: { "v": "e-module" } },
    ];
    // "9907-E-AC" matches "9907-E" via L4 (item starts with spec), not L5
    const result = matchItem("9907-E-AC", mixedSpecs);
    expect(result).not.toBeNull();
    expect(result!.specs["v"]).toBe("e-module");
  });
});

describe("ESR chassis prefix matching (F5/F10/F30/F40)", () => {
  const esrSpecs: SpecEntry[] = [
    { productModel: "F5", specs: { "交换容量": "1.2Tbps", "插槽数": "5" } },
    { productModel: "F10", specs: { "交换容量": "2.4Tbps", "插槽数": "10" } },
    { productModel: "F30", specs: { "交换容量": "6.4Tbps", "插槽数": "30" } },
    { productModel: "F40", specs: { "交换容量": "12.8Tbps", "插槽数": "40" } },
  ];

  it("F5-E-AC matches F5 via L4", () => {
    const result = matchItem("F5-E-AC", esrSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("F5");
    expect(result!.specs["插槽数"]).toBe("5");
  });

  it("F10-E-DC matches F10 via L4", () => {
    const result = matchItem("F10-E-DC", esrSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("F10");
  });

  it("F30-E-AC matches F30 via L4", () => {
    const result = matchItem("F30-E-AC", esrSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("F30");
  });

  it("F40-E-DC matches F40 via L4", () => {
    const result = matchItem("F40-E-DC", esrSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("F40");
  });

  it("F10 has priority over F5 for F10-E-AC (longest prefix wins)", () => {
    const result = matchItem("F10-E-AC", esrSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("F10");
    expect(result!.specs["插槽数"]).toBe("10");
  });

  it("L5 reverse: item F5 matches spec F5-E-AC when no exact F5 exists", () => {
    const moduleSpecs: SpecEntry[] = [
      { productModel: "F5-E-AC", specs: { "电源": "AC" } },
      { productModel: "F5-E-DC", specs: { "电源": "DC" } },
    ];
    const result = matchItem("F5", moduleSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("F5-E-AC");
  });

  it("case insensitive ESR matching", () => {
    const result = matchItem("f5-e-ac", esrSpecs);
    expect(result).not.toBeNull();
    expect(result!.productModel).toBe("F5");
  });
});;
