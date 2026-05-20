@echo off
chcp 65001 >nul
title ALE DAN CPL 报价系统
echo ========================================
echo   ALE DAN CPL 报价系统 - 启动服务
echo ========================================
echo.
cd /d "%~dp0"

:: 启动 MySQL
echo [1/2] 启动 MySQL 数据库...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I "mysqld.exe" >NUL
if %ERRORLEVEL% NEQ 0 (
    start /B "" "D:\Tools\mysql\bin\mysqld" --console
    timeout /t 3 >nul
    echo       MySQL 已启动。
) else (
    echo       MySQL 已在运行。
)

:: 启动应用
echo [2/2] 启动应用服务...
echo.
echo ========================================
echo   服务地址: http://localhost:3000/
echo   按 Ctrl+C 停止服务
echo ========================================
echo.
npx cross-env NODE_ENV=development tsx watch server/_core/index.ts
pause
