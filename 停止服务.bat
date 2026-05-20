@echo off
chcp 65001 >nul
echo ========================================
echo   ALE DAN CPL 报价系统 - 停止服务
echo ========================================
echo.

:: 停止应用服务
echo [1/2] 停止应用服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo       停止应用 (PID: %%a) ...
    taskkill /PID %%a /F >nul 2>&1
)
echo       应用服务已停止。

:: 停止 MySQL
echo [2/2] 停止 MySQL 数据库...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I "mysqld.exe" >NUL
if %ERRORLEVEL% EQU 0 (
    "D:\Tools\mysql\bin\mysqladmin" -u root shutdown >nul 2>&1
    echo       MySQL 已停止。
) else (
    echo       MySQL 未在运行。
)

echo.
echo ========================================
echo   所有服务已停止。
echo ========================================
timeout /t 3 >nul
