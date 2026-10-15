# 📦 App Store Release & Legal Kit: «Как я?» (EN: «How Am I?»)

Полный комплект юридической документации, метаданных ASO и конфигурации App Store Connect для публикации приложения в Apple App Store.

---

## 📂 Структура комплекта

| Файл | Назначение | Соответствие гайдлайнам Apple |
| :--- | :--- | :--- |
| **[PRIVACY_POLICY.md](./PRIVACY_POLICY.md)** | Политика конфиденциальности (RU & EN) | Apple Guideline 5.1.1, GDPR, CCPA, Zero-Data |
| **[TERMS_OF_SERVICE_AND_EULA.md](./TERMS_OF_SERVICE_AND_EULA.md)** | Пользовательское соглашение и EULA (RU & EN) | Apple Standard EULA, Schedule 2 PLA |
| **[MEDICAL_DISCLAIMER.md](./MEDICAL_DISCLAIMER.md)** | Медицинский отказ от ответственности (RU & EN) | Apple Guideline 1.4.1 (Safety — Medical), кризисные линии |
| **[APP_STORE_METADATA.md](./APP_STORE_METADATA.md)** | Метаданные карточки App Store (RU & EN) | Title (≤30), Subtitle (≤30), Keywords (≤100), Description (≤4000) |
| **[APP_STORE_CONNECT_CONFIG.md](./APP_STORE_CONNECT_CONFIG.md)** | Анкеты и инструкции для App Store Connect | Privacy Questionnaire, Age Rating, Review Notes для модератора |

---

## ⚡ Быстрый чек-лист перед отправкой на ревью (App Review Checklist)

1. **Замена плейсхолдеров:**
   * Замените `[support-email@domain.com]` на ваш реальный рабочий email поддержки.
   * Замените `[Developer/Company Name]` на имя разработчика или юридическое лицо в Apple Developer Program.
   * Замените ссылки `https://[your-domain.com]/privacy` на фактический URL (например, разместите Markdown на GitHub Pages, Notion или вашем сайте).

2. **Заполнение App Store Connect:**
   * **App Name & Subtitle:** Скопируйте из [APP_STORE_METADATA.md](./APP_STORE_METADATA.md).
   * **Keywords & Description:** Скопируйте из [APP_STORE_METADATA.md](./APP_STORE_METADATA.md).
   * **Privacy Questionnaire:** Укажите `Data Not Collected` в соответствии с [APP_STORE_CONNECT_CONFIG.md](./APP_STORE_CONNECT_CONFIG.md).
   * **App Review Notes:** Скопируйте готовый текст на английском языке из раздела 3 [APP_STORE_CONNECT_CONFIG.md](./APP_STORE_CONNECT_CONFIG.md).

3. **Сборка бинарника:**
   * Убедитесь, что `CFBundleDisplayName` равен `Как я?` (настроено в `app.json`).
   * Убедитесь, что Bundle ID равен `com.howami.app`.
