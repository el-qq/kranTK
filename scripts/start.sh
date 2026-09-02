#!/usr/bin/env bash
# Запуск демо-стенда одной командой: ./scripts/start.sh
# Проверяет Node, при необходимости ставит зависимости, собирает и открывает браузер.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js. Установите LTS-версию с https://nodejs.org и повторите." >&2
  exit 1
fi

# Требование Vite 8: ^20.19.0 || >=22.12.0 — просто «мажор 20» не подходит.
if ! node -e 'const v=process.versions.node.split(".").map(Number);process.exit(((v[0]===20&&v[1]>=19)||(v[0]===22&&v[1]>=12)||v[0]>22)?0:1)'; then
  echo "Нужен Node.js 22.12+ (подойдёт и 20.19+), установлен $(node -v)." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Устанавливаю зависимости…"
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
fi

echo "Собираю и запускаю на http://localhost:4173 …"
npm run start
