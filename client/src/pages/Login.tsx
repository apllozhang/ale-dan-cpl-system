import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Lock, User, Shield, Loader2, RefreshCw } from "lucide-react";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChar() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return chars[Math.floor(Math.random() * chars.length)];
}

function generateCaptcha() {
  const chars = [randomChar(), randomChar(), randomChar(), randomChar()];
  return { chars, text: chars.join("") };
}

// ==================== Canvas Captcha ====================
function CaptchaImage({ chars, width, height, onRefresh }: {
  chars: string[];
  width: number;
  height: number;
  onRefresh: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale for HiDPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    // Background - gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, `hsl(${randomInt(0, 360)}, 15%, ${randomInt(92, 97)}%)`);
    bgGrad.addColorStop(1, `hsl(${randomInt(0, 360)}, 20%, ${randomInt(88, 93)}%)`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Interference lines
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const y = randomInt(0, height);
      ctx.moveTo(0, y);
      // Bezier curve for wavy lines
      const cp1x = width * 0.25;
      const cp1y = y + randomInt(-15, 15);
      const cp2x = width * 0.75;
      const cp2y = y + randomInt(-15, 15);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, width, y + randomInt(-10, 10));
      ctx.strokeStyle = `hsl(${randomInt(0, 360)}, 50%, ${randomInt(55, 75)}%)`;
      ctx.lineWidth = randomInt(1, 3);
      ctx.stroke();
    }

    // Noise dots
    for (let i = 0; i < 80; i++) {
      const x = randomInt(0, width);
      const y = randomInt(0, height);
      ctx.fillStyle = `hsl(${randomInt(0, 360)}, 40%, ${randomInt(30, 70)}%)`;
      ctx.fillRect(x, y, randomInt(1, 3), randomInt(1, 3));
    }

    // Mosaic blocks (small pixelation patches)
    for (let i = 0; i < 15; i++) {
      const x = randomInt(0, width - 8);
      const y = randomInt(0, height - 8);
      const s = randomInt(3, 6);
      ctx.fillStyle = `hsl(${randomInt(0, 360)}, 30%, ${randomInt(60, 90)}%)`;
      ctx.fillRect(x, y, s, s);
    }

    // Draw characters with rotation and offset
    const charWidth = width / chars.length;
    chars.forEach((ch, idx) => {
      ctx.save();
      const x = charWidth * idx + charWidth * 0.5;
      const y = height * 0.5 + randomInt(-5, 5);
      const angle = (randomInt(-30, 30) * Math.PI) / 180;
      const fontSize = randomInt(22, 28);

      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `hsl(${randomInt(200, 300)}, ${randomInt(40, 70)}%, ${randomInt(25, 45)}%)`;
      ctx.font = `${randomInt(0, 1) ? "bold" : "normal"} ${fontSize}px "Courier New", monospace`;
      ctx.fillText(ch, 0, 0);
      ctx.restore();

      // Duplicate faint offset (ghost)
      ctx.save();
      ctx.translate(x + randomInt(-2, 2), y + randomInt(-2, 2));
      ctx.rotate(angle + (randomInt(-5, 5) * Math.PI) / 180);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `hsla(${randomInt(200, 300)}, 30%, 50%, 0.15)`;
      ctx.font = `${fontSize - 2}px "Courier New", monospace`;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });

    // Cross-hatching
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(randomInt(0, width), 0);
      ctx.lineTo(randomInt(0, width), height);
      ctx.strokeStyle = `hsla(0, 0%, 50%, 0.15)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [chars, width, height]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onRefresh}
      className="rounded cursor-pointer border border-border/60 w-full"
      title="点击刷新"
    />
  );
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  const [captcha, setCaptcha] = useState(generateCaptcha);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message || "登录失败，请重试");
      setCaptcha(generateCaptcha());
      setCaptchaAnswer("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }
    // TODO: 验证码功能暂时禁用，上线时启用
    // if (!captchaAnswer.trim()) {
    //   setError("请输入验证码");
    //   return;
    // }
    // if (captchaAnswer.trim().toUpperCase() !== captcha.text) {
    //   setError("验证码错误，请重新输入");
    //   setCaptcha(generateCaptcha());
    //   setCaptchaAnswer("");
    //   return;
    // }
    loginMutation.mutate({ username: username.trim(), password });
  };

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer("");
    setError("");
  }, []);

  return (
    <div className="min-h-screen flex">
      {/* Left panel - decorative */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.35 0.18 280) 0%, oklch(0.45 0.20 290) 50%, oklch(0.40 0.16 270) 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full border border-white/30" />
          <div className="absolute bottom-32 right-8 w-48 h-48 rounded-full border border-white/20" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full border border-white/15" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-lg font-semibold tracking-wide opacity-90">ALE</span>
            </div>
          </div>
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              DAN CPL<br />管理系统
            </h1>
            <p className="text-base text-white/70 leading-relaxed max-w-sm">
              Alcatel-Lucent Enterprise 产品价格表管理平台，提供数据查询、筛选与导入功能。
            </p>
          </div>
          <div className="text-xs text-white/40">
            &copy; {new Date().getFullYear()} Alcatel-Lucent Enterprise
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground">ALE</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">DAN CPL 管理系统</h1>
          </div>

          <div className="space-y-2 mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              欢迎登录
            </h2>
            <p className="text-sm text-muted-foreground">
              请输入您的账号信息以访问系统
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                用户名
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-11 bg-secondary/50 border-border/60 focus:bg-background transition-colors"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-secondary/50 border-border/60 focus:bg-background transition-colors"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* TODO: 验证码功能暂时禁用，上线时启用 */}
            {/* <div className="space-y-2">
              <Label htmlFor="captcha" className="text-sm font-medium text-foreground">
                验证码 · 输入图中字符
              </Label>
              <CaptchaImage
                chars={captcha.chars}
                width={280}
                height={56}
                onRefresh={refreshCaptcha}
              />
              <div className="flex gap-2">
                <Input
                  id="captcha"
                  type="text"
                  placeholder="输入图中字符"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase())}
                  className="h-11 bg-secondary/50 border-border/60 focus:bg-background transition-colors flex-1 font-mono text-lg tracking-wider"
                  autoComplete="off"
                  maxLength={4}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={refreshCaptcha}
                  title="换一个"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div> */}

            {error && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-sm font-medium shadow-sm transition-all active:scale-[0.98]"
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

          <div className="mt-8 pt-6 border-t border-border/40">
            <p className="text-xs text-muted-foreground text-center">
              ALE DAN CPL 系统 · 仅限授权用户访问
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
