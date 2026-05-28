import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { Lock, User, Loader2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuth } from "@/_core/hooks/useAuth";

gsap.registerPlugin(useGSAP);

// ==================== Full-screen Immersive Carousel ====================
const CAROUSEL_IMAGES = [
  "/carousel-1.jpg",  // Data center infrastructure
  "/carousel-2.jpg",  // Global manufacturing & delivery
  "/carousel-3.jpg",  // Scalable performance
  "/carousel-4.jpg",  // Digital transformation
];

const SLIDE_TEXTS = [
  "产品全域可视，一键智能更新",
  "多维智能筛选，精准锁定数据",
  "项目报价管理，高效跟踪价表",
  "业务趋势洞察，赋能销售决策",
];

function FullScreenCarousel({ onIndexChange }: { onIndexChange?: (index: number) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState<boolean[]>([false, false, false, false]);
  const [animationsReady, setAnimationsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<(HTMLDivElement | null)[]>([]);
  const indicatorsRef = useRef<(HTMLDivElement | null)[]>([]);
  const kenBurnsRef = useRef<gsap.core.Tween | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Lazy load images using Intersection Observer
  useEffect(() => {
    // Only load first image immediately, others on demand
    const img = new Image();
    img.onload = () => {
      setImagesLoaded(prev => { const n = [...prev]; n[0] = true; return n; });
      setAnimationsReady(true);
    };
    img.src = CAROUSEL_IMAGES[0];

    // Setup Intersection Observer for lazy loading remaining images
    if (containerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              // Container is visible, preload remaining images
              CAROUSEL_IMAGES.slice(1).forEach((src, i) => {
                const img = new Image();
                img.onload = () => {
                  setImagesLoaded(prev => { const n = [...prev]; n[i + 1] = true; return n; });
                };
                img.src = src;
              });
              observerRef.current?.disconnect();
            }
          });
        },
        { threshold: 0.1 }
      );
      observerRef.current.observe(containerRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Ken Burns effect on current image (slow zoom + pan)
  const startKenBurns = useCallback((layerIdx: number) => {
    if (kenBurnsRef.current) kenBurnsRef.current.kill();
    const el = layersRef.current[layerIdx];
    if (!el) return;
    // Randomize direction for variety
    const xShift = layerIdx % 2 === 0 ? -15 : 15;
    kenBurnsRef.current = gsap.fromTo(el,
      { scale: 1.0, x: 0 },
      { scale: 1.12, x: xShift, duration: 8, ease: "none" }
    );
  }, []);

  // Carousel transition with GSAP - only start when animations are ready
  useEffect(() => {
    if (!animationsReady) return;

    // Start Ken Burns on first image
    startKenBurns(0);

    timerRef.current = setInterval(() => {
      const next = (currentIndex + 1) % CAROUSEL_IMAGES.length;
      const currentLayer = layersRef.current[currentIndex];
      const nextLayer = layersRef.current[next];
      const currentDot = indicatorsRef.current[currentIndex];
      const nextDot = indicatorsRef.current[next];

      if (!currentLayer || !nextLayer) return;

      // Kill previous Ken Burns
      if (kenBurnsRef.current) kenBurnsRef.current.kill();

      // Prepare next image
      gsap.set(nextLayer, { opacity: 0, scale: 1.0, x: 0 });

      // Crossfade + Ken Burns on new image
      const tl = gsap.timeline();
      tl.to(currentLayer, { opacity: 0, duration: 1.4, ease: "power2.inOut" }, 0);
      tl.to(nextLayer, { opacity: 1, duration: 1.4, ease: "power2.inOut" }, 0);
      tl.call(() => {
        startKenBurns(next);
        setCurrentIndex(next);
        onIndexChange?.(next);
      }, undefined, 0.7);

      // Indicator animation
      if (currentDot) gsap.to(currentDot, { width: 8, backgroundColor: "rgba(255,255,255,0.3)", duration: 0.5, ease: "power2.out" });
      if (nextDot) gsap.to(nextDot, { width: 32, backgroundColor: "rgba(255,255,255,0.8)", duration: 0.5, ease: "power2.out" });
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (kenBurnsRef.current) kenBurnsRef.current.kill();
    };
  }, [currentIndex, animationsReady, startKenBurns]);

  return (
    <div className="absolute inset-0 overflow-hidden" ref={containerRef}>
      {/* Fallback gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0533] via-[#2d1b4e] to-[#0f1b3d]" />

      {/* Image layers with will-change optimization */}
      {CAROUSEL_IMAGES.map((src, i) => (
        <div
          key={i}
          ref={el => { layersRef.current[i] = el; }}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${src})`,
            opacity: i === 0 && imagesLoaded[0] ? 1 : 0,
            willChange: i === currentIndex || i === (currentIndex + 1) % CAROUSEL_IMAGES.length ? "transform, opacity" : "auto",
            transform: "translate3d(0, 0, 0)", // GPU acceleration
          }}
        />
      ))}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#1a0533]/85 via-[#1a0533]/50 to-[#1a0533]/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d001a]/60 via-transparent to-[#1a0533]/40" />

      {/* Grain texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />


    </div>
  );
}

// ==================== Rotating Slide Text ====================
function RotatingText({ currentIndex }: { currentIndex: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const prevIndex = useRef(currentIndex);
  const text = SLIDE_TEXTS[currentIndex];
  const chars = text.split("");

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const charEls = containerRef.current!.querySelectorAll(".anim-char");
      const line = lineRef.current;
      const bar = progressBarRef.current;

      if (prevIndex.current === currentIndex) {
        // Initial entrance animation
        const tl = gsap.timeline({ delay: 0.8 });
        tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.out" });
        tl.fromTo(charEls, { opacity: 0, y: 15 }, { opacity: 1, y: 0, stagger: 0.025, duration: 0.4, ease: "power2.out" }, "-=0.3");
        tl.fromTo(bar, { scaleX: 0, transformOrigin: "left" }, { scaleX: 1, duration: 6, ease: "none" }, "-=0.5");
        return;
      }

      // Slide transition
      const tl = gsap.timeline();

      // Exit: chars fly out upward with stagger
      tl.to(charEls, {
        opacity: 0, y: -12, stagger: { each: 0.015, from: "end" },
        duration: 0.3, ease: "power2.in",
      });
      // Exit: line shrinks
      tl.to(line, { scaleX: 0, duration: 0.25, ease: "power2.in" }, "-=0.3");

      // Reset progress bar
      tl.set(bar, { scaleX: 0, transformOrigin: "left" }, "-=0.1");

      // Update text
      tl.call(() => { prevIndex.current = currentIndex; });

      // Enter: line expands
      tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out" });
      // Enter: chars fly in from below
      tl.fromTo(charEls, { opacity: 0, y: 15 }, { opacity: 1, y: 0, stagger: 0.025, duration: 0.35, ease: "power2.out" }, "-=0.3");
      // Enter: progress bar fills
      tl.fromTo(bar, { scaleX: 0, transformOrigin: "left" }, { scaleX: 1, duration: 6, ease: "none" }, "-=0.3");
    }, containerRef);

    return () => ctx.revert();
  }, [currentIndex, text]);

  return (
    <div ref={containerRef} className="mt-6">
      {/* Animated divider line */}
      <div className="h-px w-16 bg-white/30 mb-4 overflow-hidden">
        <div ref={lineRef} className="h-full w-full bg-purple-400 origin-left" />
      </div>

      {/* Character-animated text */}
      <div className="overflow-hidden min-h-[3.5rem]">
        <div className="text-xl lg:text-2xl font-medium text-white/85 tracking-wide leading-relaxed flex flex-wrap">
          {chars.map((char, i) => (
            <span
              key={`${currentIndex}-${i}`}
              className="anim-char inline-block"
              style={{ opacity: 0 }}
            >
              {char === " " ? " " : char}
            </span>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div ref={progressBarRef} className="h-full bg-purple-400/60 rounded-full" />
      </div>
    </div>
  );
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const loginRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const visibilityRef = useRef<HTMLDivElement>(null);
  const animationsInitializedRef = useRef(false);

  // Login page should not be affected by dark mode
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => { if (wasDark) root.classList.add("dark"); };
  }, []);

  // Detect when login form is visible to trigger entrance animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !animationsInitializedRef.current) {
            setIsVisible(true);
            animationsInitializedRef.current = true;
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (visibilityRef.current) {
      observer.observe(visibilityRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Entrance animation - only runs when visible
  useLayoutEffect(() => {
    if (!isVisible || !loginRef.current) return;

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      const ctx = gsap.context(() => {
        // Stagger entrance animations for better performance
        gsap.fromTo(".login-brand", 
          { x: -60, opacity: 0 }, 
          { x: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.2 }
        );
        
        gsap.fromTo(".login-card", 
          { y: 40, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", delay: 0.3 }
        );
        
        gsap.fromTo(".login-card .space-y-2", 
          { y: 20, opacity: 0 }, 
          { y: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: "power2.out", delay: 0.4 }
        );
        
        gsap.fromTo(".login-card .login-btn", 
          { y: 15, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.6 }
        );
      }, loginRef);

      return () => ctx.revert();
    });

    return () => cancelAnimationFrame(rafId);
  }, [isVisible]);

  const { loading } = useAuth();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message || "登录失败，请重试");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div className="min-h-screen relative flex" ref={loginRef}>
      {/* Full-screen background carousel */}
      <FullScreenCarousel onIndexChange={setSlideIndex} />

      {/* Content layer */}
      <div className="relative z-10 flex w-full min-h-screen">
        {/* Left branding area */}
        <div className="login-brand hidden lg:flex lg:flex-1 flex-col p-16 pb-8">
          {/* Top - Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-white/90 text-lg font-medium tracking-wider">Digital Age Networking</span>
          </div>

          {/* Center - Main headline + rotating text */}
          <div className="flex-1 flex flex-col justify-center max-w-lg -mt-8">
            <h1 className="text-5xl font-bold text-white leading-tight mb-4 tracking-tight">
              DAN CPL
              <br />
              <span className="text-white/70 text-3xl font-light">管理系统</span>
            </h1>

            {/* Rotating feature text */}
            <RotatingText currentIndex={slideIndex} />
          </div>

          {/* Bottom - Copyright */}
          <div className="text-white/30 text-sm">
            &copy; {new Date().getFullYear()} Digital Age Networking
          </div>
        </div>

        {/* Right login panel */}
        <div className="w-full lg:w-[480px] xl:w-[520px] flex items-center justify-center p-6 sm:p-12" ref={visibilityRef}>
          <div className="w-full max-w-[380px]">
            {/* Glassmorphism card */}
            <div className="login-card relative rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/40 border border-white/20 bg-white/90 backdrop-blur-xl" style={{ willChange: "transform, opacity" }}>
              {/* Mobile logo */}
              <div className="lg:hidden mb-8 text-center">
                <div className="inline-flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-300 flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-xs">D</span>
                  </div>
                  <span className="text-gray-900 font-medium">DAN CPL</span>
                </div>
              </div>

              <div className="space-y-1 mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
                  欢迎登录
                </h2>
                <p className="text-sm text-gray-500">
                  请输入您的账号信息以访问系统
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                    用户名
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="请输入用户名"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-11 h-12 bg-white/60 border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    密码
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 h-12 bg-white/60 border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="login-btn w-full h-12 text-sm font-medium rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-purple-900/30 transition-all active:scale-[0.98]"
                  disabled={loginMutation.isPending || loading}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    "登 录"
                  )}
                </Button>
              </form>

              {/* Footer */}
              <div className="mt-8 text-center text-xs text-gray-500">
                DAN CPL 系统 - 仅授权用户访问
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
