import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Lock, User, Loader2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// ==================== Full-screen Immersive Carousel ====================
const CAROUSEL_IMAGES = [
  "/carousel-1.jpg",  // Data center infrastructure
  "/carousel-2.jpg",  // Global manufacturing & delivery
  "/carousel-3.jpg",  // Scalable performance
  "/carousel-4.jpg",  // Digital transformation
];

function FullScreenCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState<boolean[]>([false, false, false, false]);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<(HTMLDivElement | null)[]>([]);
  const indicatorsRef = useRef<(HTMLDivElement | null)[]>([]);
  const kenBurnsRef = useRef<gsap.core.Tween | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Preload images
  useEffect(() => {
    CAROUSEL_IMAGES.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        setImagesLoaded(prev => { const n = [...prev]; n[i] = true; return n; });
      };
      img.src = src;
    });
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

  // Carousel transition with GSAP
  useEffect(() => {
    if (!imagesLoaded[0]) return;

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
      }, undefined, 0.7);

      // Indicator animation
      if (currentDot) gsap.to(currentDot, { width: 8, backgroundColor: "rgba(255,255,255,0.3)", duration: 0.5, ease: "power2.out" });
      if (nextDot) gsap.to(nextDot, { width: 32, backgroundColor: "rgba(255,255,255,0.8)", duration: 0.5, ease: "power2.out" });
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (kenBurnsRef.current) kenBurnsRef.current.kill();
    };
  }, [currentIndex, imagesLoaded, startKenBurns]);

  return (
    <div className="absolute inset-0 overflow-hidden" ref={containerRef}>
      {/* Fallback gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0533] via-[#2d1b4e] to-[#0f1b3d]" />

      {/* Image layers */}
      {CAROUSEL_IMAGES.map((src, i) => (
        <div
          key={i}
          ref={el => { layersRef.current[i] = el; }}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${src})`,
            opacity: i === 0 && imagesLoaded[0] ? 1 : 0,
          }}
        />
      ))}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#1a0533]/85 via-[#1a0533]/50 to-[#1a0533]/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d001a]/60 via-transparent to-[#1a0533]/40" />

      {/* Grain texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

      {/* Carousel indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {CAROUSEL_IMAGES.map((_, idx) => (
          <div
            key={idx}
            ref={el => { indicatorsRef.current[idx] = el; }}
            className="h-1 rounded-full"
            style={{
              width: idx === 0 ? 32 : 8,
              backgroundColor: idx === 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
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

  // Entrance animation
  useGSAP(() => {
    gsap.fromTo(".login-brand", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.3 });
    gsap.fromTo(".login-card", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", delay: 0.5 });
    gsap.fromTo(".login-card .space-y-2", { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.7, ease: "power2.out", delay: 0.7 });
    gsap.fromTo(".login-card .login-btn", { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 1.0 });
  }, { scope: loginRef });

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
      <FullScreenCarousel />

      {/* Content layer */}
      <div className="relative z-10 flex w-full min-h-screen">
        {/* Left branding area */}
        <div className="login-brand hidden lg:flex lg:flex-1 flex-col justify-between p-16">
          {/* Top - Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-white/90 text-lg font-medium tracking-wider">Digital Age Networking</span>
          </div>

          {/* Center - Main headline */}
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold text-white leading-tight mb-6 tracking-tight">
              DAN CPL
              <br />
              <span className="text-white/70 text-3xl font-light">管理系统</span>
            </h1>
            <p className="text-white/50 text-lg leading-relaxed">
              DAN 产品价格表管理平台，提供数据查询、筛选与导入功能。
            </p>
          </div>

          {/* Bottom - Copyright */}
          <div className="text-white/30 text-sm">
            &copy; {new Date().getFullYear()} Digital Age Networking
          </div>
        </div>

        {/* Right login panel */}
        <div className="w-full lg:w-[480px] xl:w-[520px] flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[380px]">
            {/* Glassmorphism card */}
            <div className="login-card relative rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/40 border border-white/20 bg-white/90 backdrop-blur-xl">
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
                  disabled={loginMutation.isPending}
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

              <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-400 text-center">
                  DAN CPL 系统 · 仅限授权用户访问
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
