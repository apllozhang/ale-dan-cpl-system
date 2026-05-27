import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Lock, User, Loader2 } from "lucide-react";

// ==================== Full-screen Immersive Carousel ====================
const CAROUSEL_IMAGES = [
  "/manus-storage/image16_4734f983.jpeg",  // Data center
  "/manus-storage/image15_38a00973.jpeg",  // Network management
  "/manus-storage/image17_5f6d8f10.jpeg",  // Office collaboration
  "/manus-storage/image18_7be7816e.jpeg",  // Reception
];

function FullScreenCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState<boolean[]>([false, false, false, false]);

  // Preload images progressively: first image immediately, others after first loads
  useEffect(() => {
    // Load first image immediately
    const firstImg = new Image();
    firstImg.onload = () => {
      setImagesLoaded(prev => { const n = [...prev]; n[0] = true; return n; });
      // After first image loads, preload the rest
      CAROUSEL_IMAGES.slice(1).forEach((src, i) => {
        const img = new Image();
        img.onload = () => {
          setImagesLoaded(prev => { const n = [...prev]; n[i + 1] = true; return n; });
        };
        img.src = src;
      });
    };
    firstImg.src = CAROUSEL_IMAGES[0];
  }, []);

  useEffect(() => {
    // Only start carousel after first image is loaded
    if (!imagesLoaded[0]) return;

    const timer = setInterval(() => {
      setTransitioning(true);
      const next = (currentIndex + 1) % CAROUSEL_IMAGES.length;
      setNextIndex(next);
      
      setTimeout(() => {
        setCurrentIndex(next);
        setTransitioning(false);
      }, 1200);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentIndex, imagesLoaded]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fallback gradient background (shows while images load) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0533] via-[#2d1b4e] to-[#0f1b3d]" />

      {/* Current image - only show when loaded */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-all duration-[1500ms] ${
          imagesLoaded[currentIndex] ? "opacity-100" : "opacity-0"
        }`}
        style={{
          backgroundImage: `url(${CAROUSEL_IMAGES[currentIndex]})`,
          transform: "scale(1.03)",
        }}
      />
      
      {/* Next image (fades in during transition) */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-[1200ms] ${
          transitioning && imagesLoaded[nextIndex] ? "opacity-100" : "opacity-0"
        }`}
        style={{
          backgroundImage: `url(${CAROUSEL_IMAGES[nextIndex]})`,
        }}
      />

      {/* Gradient overlays for depth and readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#1a0533]/85 via-[#1a0533]/50 to-[#1a0533]/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d001a]/60 via-transparent to-[#1a0533]/40" />
      
      {/* Subtle grain texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

      {/* Carousel indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {CAROUSEL_IMAGES.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all duration-700 ${
              idx === currentIndex
                ? "w-8 bg-white/80"
                : "w-2 bg-white/30"
            }`}
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
    <div className="min-h-screen relative flex">
      {/* Full-screen background carousel */}
      <FullScreenCarousel />

      {/* Content layer */}
      <div className="relative z-10 flex w-full min-h-screen">
        {/* Left branding area */}
        <div className="hidden lg:flex lg:flex-1 flex-col justify-between p-16">
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
            {/* White card with purple border - Scheme 1 */}
            <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/40 border-2 border-transparent bg-clip-padding"
              style={{
                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #a78bfa, #8b5cf6, #7c3aed)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}>
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
                      className="pl-11 h-12 bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
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
                      className="pl-11 h-12 bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
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
                  className="w-full h-12 text-sm font-medium rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-purple-900/30 transition-all active:scale-[0.98]"
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
