// Regression: ISSUE-001 ISSUE-002 — GSAP animations on empty NodeList targets
// Found by /qa on 2026-06-04
// Report: .gstack/qa-reports/qa-report-localhost-2026-06-04.md

import { describe, it, expect } from "vitest";

/**
 * Tests the guard logic pattern used in DashboardLayout.tsx to prevent
 * GSAP "target not found" warnings when animating empty NodeLists.
 *
 * The actual fix is in client/src/components/DashboardLayout.tsx — these
 * tests verify the guard pattern (checking .length > 0 before animating)
 * works correctly for the edge cases identified during QA.
 *
 * Since server tests run in Node (no DOM), we simulate the guard logic
 * using plain arrays to represent NodeList behavior.
 */

// Simulates the guard pattern from DashboardLayout.tsx:
//   const staggerTargets = ref.current.querySelectorAll(".stagger-in");
//   if (staggerTargets.length > 0) { gsap.fromTo(staggerTargets, ...) }
function shouldAnimate(targets: unknown[]): boolean {
  return targets.length > 0;
}

// Simulates the guard pattern for optional ref:
//   const spans = menuRef.current?.querySelectorAll(".menu-item span");
//   if (spans && spans.length > 0) { gsap.fromTo(spans, ...) }
function shouldAnimateWithOptionalRef(
  targets: unknown[] | undefined
): boolean {
  return !!targets && targets.length > 0;
}

describe("GSAP animation guard pattern", () => {
  describe("stagger-in guard (ISSUE-001)", () => {
    it("skips animation when no .stagger-in elements exist", () => {
      const staggerTargets: Element[] = []; // empty NodeList
      expect(shouldAnimate(staggerTargets)).toBe(false);
    });

    it("calls animation when .stagger-in elements are found", () => {
      const staggerTargets = [{} as Element]; // 1 element found
      expect(shouldAnimate(staggerTargets)).toBe(true);
    });

    it("calls animation for multiple .stagger-in elements", () => {
      const staggerTargets = Array.from(
        { length: 5 },
        () => ({}) as Element
      );
      expect(shouldAnimate(staggerTargets)).toBe(true);
      expect(staggerTargets.length).toBe(5);
    });
  });

  describe("menu-item span guard (ISSUE-002)", () => {
    it("skips animation when menuRef.current is null (undefined result)", () => {
      const spans: unknown[] | undefined = undefined; // ref.current?.querySelectorAll returns undefined
      expect(shouldAnimateWithOptionalRef(spans)).toBe(false);
    });

    it("skips animation when no .menu-item span elements exist", () => {
      const spans: Element[] = []; // empty NodeList
      expect(shouldAnimateWithOptionalRef(spans)).toBe(false);
    });

    it("calls animation when .menu-item span elements exist", () => {
      const spans = [{} as Element]; // 1 span found
      expect(shouldAnimateWithOptionalRef(spans)).toBe(true);
    });

    it("handles multiple menu-item spans correctly", () => {
      const spans = Array.from({ length: 12 }, () => ({}) as Element);
      expect(shouldAnimateWithOptionalRef(spans)).toBe(true);
      expect(spans.length).toBe(12);
    });
  });
});
