/**
 * Optimized image preloader for carousel
 * Implements lazy loading with Intersection Observer
 * and efficient image caching
 */

export interface ImagePreloadConfig {
  urls: string[];
  priority?: "high" | "low";
  timeout?: number;
}

class ImagePreloader {
  private loadedImages = new Set<string>();
  private loadingImages = new Map<string, Promise<void>>();
  private imageCache = new Map<string, HTMLImageElement>();

  /**
   * Preload a single image
   */
  private loadImage(url: string): Promise<void> {
    // Return cached promise if already loading
    if (this.loadingImages.has(url)) {
      return this.loadingImages.get(url)!;
    }

    // Return immediately if already loaded
    if (this.loadedImages.has(url)) {
      return Promise.resolve();
    }

    const loadPromise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      
      // Set timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        reject(new Error(`Image load timeout: ${url}`));
      }, 30000); // 30 second timeout

      img.onload = () => {
        clearTimeout(timeoutId);
        this.loadedImages.add(url);
        this.imageCache.set(url, img);
        this.loadingImages.delete(url);
        resolve();
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        this.loadingImages.delete(url);
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = url;
    });

    this.loadingImages.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Preload multiple images with priority
   */
  public async preloadImages(config: ImagePreloadConfig): Promise<void> {
    const { urls, priority = "low", timeout = 30000 } = config;

    if (urls.length === 0) return;

    // Load first image with high priority
    if (priority === "high" && urls.length > 0) {
      try {
        await this.loadImage(urls[0]);
      } catch (error) {
        console.warn("Failed to load priority image:", error);
      }
    }

    // Load remaining images in background
    const remainingUrls = priority === "high" ? urls.slice(1) : urls;
    remainingUrls.forEach(url => {
      this.loadImage(url).catch(error => {
        console.warn("Background image load failed:", error);
      });
    });
  }

  /**
   * Setup lazy loading with Intersection Observer
   */
  public setupLazyLoading(
    container: HTMLElement,
    imageUrls: string[],
    onReady?: () => void
  ): IntersectionObserver {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Container is visible, preload remaining images
            this.preloadImages({
              urls: imageUrls,
              priority: "low",
            }).then(() => {
              onReady?.();
            }).catch(error => {
              console.warn("Lazy loading failed:", error);
            });
            
            // Disconnect after first intersection
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
    return observer;
  }

  /**
   * Check if image is loaded
   */
  public isLoaded(url: string): boolean {
    return this.loadedImages.has(url);
  }

  /**
   * Get cached image element
   */
  public getCachedImage(url: string): HTMLImageElement | undefined {
    return this.imageCache.get(url);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.loadedImages.clear();
    this.loadingImages.clear();
    this.imageCache.clear();
  }

  /**
   * Get loading progress
   */
  public getProgress(): { loaded: number; total: number; percentage: number } {
    const total = this.loadedImages.size + this.loadingImages.size;
    const loaded = this.loadedImages.size;
    return {
      loaded,
      total,
      percentage: total > 0 ? Math.round((loaded / total) * 100) : 0,
    };
  }
}

export const imagePreloader = new ImagePreloader();
