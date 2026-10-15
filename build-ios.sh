#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🚀 Подготовка 'Как я?' к сборке iOS на Mac"
echo "=========================================="

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Ошибка: Node.js не найден. Установите Node.js (рекомендуется LTS с nodejs.org или 'brew install node')."
    exit 1
fi

# Проверка CocoaPods (нужен для iOS-зависимостей)
if ! command -v pod &> /dev/null; then
    echo "⚠️ Внимание: CocoaPods не найден. Устанавливаем через gem / brew..."
    sudo gem install cocoapods || brew install cocoapods || true
fi

echo ""
echo "📦 [1/3] Установка npm зависимостей..."
npm install

echo ""
echo "⚙️ [2/3] Генерация нативного iOS проекта через Expo Prebuild..."
npx expo prebuild --platform ios --clean

echo ""
echo "🍏 [3/3] Открытие Xcode Workspace..."
if [ -d "ios" ]; then
    open ios/*.xcworkspace
    echo "🎉 Успешно! Xcode запущен."
else
    echo "❌ Папка ios не найдена. Проверьте вывод ошибок выше."
    exit 1
fi

echo ""
echo "=========================================="
echo "📋 ЧТО ДЕЛАТЬ ДАЛЬШЕ В XCODE:"
echo "1. В левой панели выберите верхний синий проект 'howami'."
echo "2. Откройте вкладку 'Signing & Capabilities'."
echo "3. В поле 'Team' выберите ваш Apple Developer аккаунт."
echo "4. Проверьте 'Bundle Identifier' (должен совпадать с App Store Connect)."
echo "5. В верхней панели Xcode вместо симулятора выберите 'Any iOS Device (arm64)'."
echo "6. В верхнем меню выберите: Product -> Archive."
echo "7. После окончания сборки откроется окно Organizer:"
echo "   Нажмите 'Distribute App' -> 'App Store Connect' -> 'Upload'."
echo "=========================================="
