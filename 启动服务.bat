@echo off
chcp 65001 >nul
title ALE DAN CPL 报价系统
echo ========================================
echo   ALE DAN CPL 报价系统 - 启动服务
echo ========================================
echo.
cd /d "%~dp0"
npx cross-env NODE_ENV=development tsx watch server/_core/index.ts
pause
