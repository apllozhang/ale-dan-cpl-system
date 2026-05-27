/**
 * Performance monitoring utility for GSAP animations
 * Tracks animation performance metrics and provides optimization insights
 */

export interface PerformanceMetrics {
  initialLoadTime: number;
  animationStartTime: number;
  firstPaintTime: number;
  firstContentfulPaintTime: number;
  animationFrameDrops: number;
  averageFPS: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    initialLoadTime: 0,
    animationStartTime: 0,
    firstPaintTime: 0,
    firstContentfulPaintTime: 0,
    animationFrameDrops: 0,
    averageFPS: 60,
  };

  private frameTimestamps: number[] = [];
  private isMonitoring = false;

  /**
   * Initialize performance monitoring
   */
  public init() {
    this.recordInitialLoadTime();
    this.monitorFrameRate();
  }

  /**
   * Record initial page load time
   */
  private recordInitialLoadTime() {
    if (typeof window !== "undefined" && window.performance) {
      const perfData = window.performance.timing;
      this.metrics.initialLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      
      // Get FCP and LCP if available
      if ("PerformanceObserver" in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === "first-contentful-paint") {
                this.metrics.firstContentfulPaintTime = entry.startTime;
              }
            }
          });
          observer.observe({ entryTypes: ["paint"] });
        } catch (e) {
          // Silently fail if PerformanceObserver is not available
        }
      }
    }
  }

  /**
   * Monitor frame rate during animations
   */
  private monitorFrameRate() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    let lastTime = performance.now();
    let frameCount = 0;
    const checkInterval = 1000; // Check every 1 second

    const checkFPS = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= checkInterval) {
        const fps = Math.round((frameCount * 1000) / deltaTime);
        this.metrics.averageFPS = fps;
        
        // Detect frame drops (FPS < 50)
        if (fps < 50) {
          this.metrics.animationFrameDrops++;
        }

        frameCount = 0;
        lastTime = currentTime;
      }

      frameCount++;
      requestAnimationFrame(checkFPS);
    };

    requestAnimationFrame(checkFPS);
  }

  /**
   * Record animation start time
   */
  public recordAnimationStart() {
    this.metrics.animationStartTime = performance.now();
  }

  /**
   * Get current metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Log performance report
   */
  public logReport() {
    const metrics = this.getMetrics();
    console.log("=== GSAP Animation Performance Report ===");
    console.log(`Initial Load Time: ${metrics.initialLoadTime.toFixed(2)}ms`);
    console.log(`Animation Start Time: ${metrics.animationStartTime.toFixed(2)}ms`);
    console.log(`FCP Time: ${metrics.firstContentfulPaintTime.toFixed(2)}ms`);
    console.log(`Average FPS: ${metrics.averageFPS}`);
    console.log(`Frame Drops: ${metrics.animationFrameDrops}`);
    console.log("========================================");
  }

  /**
   * Check if animations are impacting performance
   */
  public isOptimized(): boolean {
    // Consider optimized if:
    // 1. Average FPS is >= 55
    // 2. Animation frame drops < 5
    return this.metrics.averageFPS >= 55 && this.metrics.animationFrameDrops < 5;
  }
}

export const performanceMonitor = new PerformanceMonitor();
