import { describe, it, expect, beforeEach, vi } from "vitest";
import { performanceMonitor } from "./performanceMonitor";

describe("performanceMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default metrics", () => {
    const metrics = performanceMonitor.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.averageFPS).toBe(60);
    expect(metrics.animationFrameDrops).toBe(0);
  });

  it("should record animation start time", () => {
    const before = performance.now();
    performanceMonitor.recordAnimationStart();
    const after = performance.now();
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.animationStartTime).toBeGreaterThanOrEqual(before);
    expect(metrics.animationStartTime).toBeLessThanOrEqual(after);
  });

  it("should track metrics correctly", () => {
    const metrics = performanceMonitor.getMetrics();
    
    // Verify all required metrics are present
    expect(metrics).toHaveProperty("initialLoadTime");
    expect(metrics).toHaveProperty("animationStartTime");
    expect(metrics).toHaveProperty("firstPaintTime");
    expect(metrics).toHaveProperty("firstContentfulPaintTime");
    expect(metrics).toHaveProperty("animationFrameDrops");
    expect(metrics).toHaveProperty("averageFPS");
  });

  it("should determine if animations are optimized", () => {
    const isOptimized = performanceMonitor.isOptimized();
    // Should be optimized by default (FPS=60, drops=0)
    expect(isOptimized).toBe(true);
  });

  it("should not throw when logging report", () => {
    expect(() => {
      performanceMonitor.logReport();
    }).not.toThrow();
  });

  it("should return a copy of metrics to prevent external mutation", () => {
    const metrics1 = performanceMonitor.getMetrics();
    const metrics2 = performanceMonitor.getMetrics();
    
    expect(metrics1).toEqual(metrics2);
    expect(metrics1).not.toBe(metrics2); // Different object references
  });
});
