import { describe, it, expect, beforeEach, vi } from "vitest";
import { imagePreloader } from "./imagePreloader";

describe("imagePreloader", () => {
  beforeEach(() => {
    imagePreloader.clearCache();
    vi.clearAllMocks();
  });

  it("should initialize with empty cache", () => {
    const progress = imagePreloader.getProgress();
    expect(progress.loaded).toBe(0);
    expect(progress.total).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it("should check if image is loaded", () => {
    const testUrl = "/test-image.jpg";
    expect(imagePreloader.isLoaded(testUrl)).toBe(false);
  });

  it("should clear cache", () => {
    imagePreloader.clearCache();
    const progress = imagePreloader.getProgress();
    expect(progress.loaded).toBe(0);
  });

  it("should setup lazy loading with Intersection Observer", () => {
    const container = document.createElement("div");
    const imageUrls = ["/image1.jpg", "/image2.jpg"];
    
    const observer = imagePreloader.setupLazyLoading(container, imageUrls);
    expect(observer).toBeDefined();
    expect(observer instanceof IntersectionObserver).toBe(true);
    
    observer.disconnect();
  });

  it("should handle empty image list", async () => {
    await expect(
      imagePreloader.preloadImages({ urls: [] })
    ).resolves.toBeUndefined();
  });

  it("should return undefined for non-cached image", () => {
    const cachedImage = imagePreloader.getCachedImage("/non-existent.jpg");
    expect(cachedImage).toBeUndefined();
  });

  it("should track loading progress", () => {
    const progress = imagePreloader.getProgress();
    expect(progress).toHaveProperty("loaded");
    expect(progress).toHaveProperty("total");
    expect(progress).toHaveProperty("percentage");
    expect(progress.percentage).toBeGreaterThanOrEqual(0);
    expect(progress.percentage).toBeLessThanOrEqual(100);
  });

  it("should handle priority loading configuration", async () => {
    // Test that priority parameter is accepted
    const config = {
      urls: ["/image1.jpg"],
      priority: "high" as const,
      timeout: 5000,
    };
    
    // Should not throw
    await expect(
      imagePreloader.preloadImages(config)
    ).resolves.toBeUndefined();
  });
});
