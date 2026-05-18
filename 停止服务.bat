@echo off
chcp 65001 >nul
echo ========================================
echo   ALE DAN CPL 报价系统 - 停止服务
echo ========================================
echo.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo 正在停止服务 (PID: %%a) ...
    taskkill /PID %%a /F >nul 2>&1
)
echo 服务已停止。
timeout /t 3 >nul
