@echo off
rem Запуск демо-стенда одной командой: scripts\start.cmd
setlocal
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js. Установите LTS-версию с https://nodejs.org и повторите.
  exit /b 1
)

rem Требование Vite 8: ^20.19.0 ^|^| ^>=22.12.0
node -e "const v=process.versions.node.split('.').map(Number);process.exit(((v[0]===20&&v[1]>=19)||(v[0]===22&&v[1]>=12)||v[0]>22)?0:1)"
if errorlevel 1 (
  echo Нужен Node.js 22.12 или новее ^(подойдёт и 20.19+^).
  node -v
  exit /b 1
)

if not exist node_modules (
  echo Устанавливаю зависимости...
  if exist package-lock.json (npm ci) else (npm install)
  if errorlevel 1 exit /b 1
)

echo Собираю и запускаю на http://localhost:4173 ...
npm run start
