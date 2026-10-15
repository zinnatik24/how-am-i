# Конфигурация анкет App Store Connect (Store Review Configuration)
**Приложение «Как я?» (EN: «How Am I?») — Трекер чувств и настроения**
*Готовые ответы и формулировки для заполнения в App Store Connect*

---

## 1. App Privacy Questionnaire (Сведения о конфиденциальности данных)

### Основной выбор в App Store Connect:
При ответе на вопрос *"Do you or your third-party partners collect data from this app?"* (Собираете ли вы или ваши сторонние партнеры данные из этого приложения?):

👉 **Выберите: `NO, WE DO NOT COLLECT DATA FROM THIS APP` («Нет, мы не собираем данные из этого приложения»)**

В результате в карточке App Store отобразится синий значок с надписью:
> **Data Not Collected** (Разработчик не собирает данные из этого приложения).

---

### Детальная разбивка по категориям данных (для подтверждения):
Если система или ревьюер запросит детализацию по категориям:

| Категория данных | Собирается? | Обоснование для Apple |
| :--- | :---: | :--- |
| **Contact Info** (Имя, Email, Телефон, Адрес) | **НЕТ** | Приложение работает без регистрации, учетных записей и профилей. |
| **Health & Fitness** (Здоровье и фитнес) | **НЕТ** | Данные об эмоциях сохраняются исключительно локально на устройстве (Local Sandbox). Данные не передаются на серверы и не экспортируются в HealthKit. |
| **Financial Info** (Платежные данные) | **НЕТ** | В приложении нет покупок, платных подписок или финансовых операций. |
| **Location** (Геолокация GPS) | **НЕТ** | Службы `CoreLocation` не используются. Контекстные метки («Дом», «Работа») выбираются вручную и являются лишь локальным текстом. |
| **Sensitive Info** (Раса, религия, биометрия) | **НЕТ** | Никакая чувствительная информация не запрашивается и не собирается. |
| **User Content** (Заметки, текст) | **НЕТ** | Заметки пользователя хранятся исключительно в зашифрованной локальной песочнице iPhone. |
| **Browsing History / Search History** | **НЕТ** | В приложении нет веб-браузера и внешних ссылок. |
| **Identifiers** (IDFA, User ID, Device ID) | **НЕТ** | IDFA не используется, трекинг ATT отсутствует, рекламные SDK не интегрированы. |
| **Usage Data** (Аналитика кликов, просмотров) | **НЕТ** | Сторонние аналитические трекеры (Firebase, Amplitude, Mixpanel) полностью отсутствуют. |
| **Diagnostics** (Логи сбоев, телеметрия) | **НЕТ** | Сторонние crash-репортеры не встроены. Используются только стандартные системные отчеты Apple Diagnostic на уровне ОС (если включены пользователем). |

---

## 2. Age Rating Questionnaire (Анкета возрастного рейтинга)

### Рекомендуемый возрастной рейтинг: `4+` (или `12+` в зависимости от политики региона)
Приложение безопасно для любой возрастной аудитории. Все опросные пункты анкеты Apple заполняются значением **«None» (Нет)**:

| Пункт анкеты App Store Connect | Выбираемый ответ | Пояснение |
| :--- | :---: | :--- |
| **Medical/Treatment-Focused Information** (Медицинская или лечебная тематика) | **None** | Приложение является трекером эмоционального интеллекта и самонаблюдения, а не медицинским справочником или руководством по лечению заболеваний. |
| **Violence** (Насилие в мультфильмах, реалистичное насилие) | **None** | Полностью отсутствует. |
| **Profanity or Crude Humor** (Ненормативная лексика) | **None** | Полностью отсутствует. |
| **Sexual Content or Nudity** (Сексуальный контент) | **None** | Полностью отсутствует. |
| **Alcohol, Tobacco, or Drug Use** (Алкоголь, табак, наркотики) | **None** | Полностью отсутствует. |
| **Simulated Gambling** (Азартные игры) | **None** | Полностью отсутствует. |
| **Horror/Fear Themes** (Ужасы/страх) | **None** | Полностью отсутствует. |
| **Mature/Suggestive Themes** (Темы для взрослых) | **None** | Полностью отсутствует. |
| **Contests** (Конкурсы, пари) | **None** | Полностью отсутствует. |
| **Unrestricted Web Access** (Неограниченный веб-доступ) | **No** | Браузер внутри приложения отсутствует. |

> **Примечание по ревью:** Если модератор Apple сочтет, что фиксация эмоциональных состояний (таких как грусть, тревога или злость) относится к категории «Mild Mature/Suggestive Themes» или «Mild Medical/Mental Health Info», возрастной рейтинг будет автоматически скорректирован системой до **`12+`**, что является абсолютной нормой для приложений категории Health & Fitness и не препятствует дистрибуции.

---

## 3. App Review Information (Заметки для модератора / Review Notes)

Вставьте следующий текст в поле **«Notes» (Заметки)** в разделе *App Review Information* в App Store Connect:

```text
Dear Apple App Review Team,

Thank you for reviewing "How Am I?" (Russian title: «Как я?»). Below is key architectural and functional information to assist in your review:

1. NO SIGN-IN OR ACCOUNT REQUIRED:
The application operates entirely without accounts, registration, or login screens. There are no demo credentials required. All features are immediately accessible upon launch.

2. LOCAL-FIRST & ZERO-DATA PRIVACY (Guideline 5.1.1):
The application does not collect, transmit, or store any personal or identifiable information on external servers. All user entries (emotions, contextual tags, personal notes, and check-in history) are stored strictly on-device in the local application sandbox. The app does not integrate any third-party tracking, advertising, or analytics SDKs (No IDFA, no ATT prompt needed).

3. OFFLINE CAPABILITY:
The app is fully functional in offline mode. You can test all features (quadrant selection, multi-emotion check-in, journaling, trend charts, and data reset) with Airplane Mode enabled.

4. MEDICAL DISCLAIMER & SAFETY (Guideline 1.4.1):
"How Am I?" is an educational and mindfulness tool designed to foster emotional literacy and self-reflection based on the Yale Center for Emotional Intelligence RULER framework and the Circumplex Model of Affect.
- The app DOES NOT provide medical diagnoses, psychiatric therapy, clinical assessments, or treatment recommendations.
- A prominent Medical Disclaimer is included in both localized App Store descriptions, the in-app Settings screen ("About The Method"), and our legal documentation.

5. REVIEWER TESTING FLOW:
- Tap "Отметить состояние" ("Check In") on the Home screen.
- Tap any of the 4 quadrants on the interactive mood plane (Red, Yellow, Blue, Green) to navigate into the 36-emotion grid.
- Select 1 to 3 feelings (e.g. Joy, Calm, Hope).
- In the check-in completion screen, tap contextual tags (Companions, Location, Activity) and optionally type a note.
- Tap "Готово" ("Done") to save to the local Journal.
- Navigate to the "Дневник" ("Journal") and "Тренды" ("Trends") tabs to view recorded data.
- Navigate to "Настройки" ("Settings") where you can test "Загрузить примеры данных" ("Load Sample Data") or "Очистить историю чекинов" ("Clear All Check-ins").

If you have any questions during the review process, please contact us immediately:
Contact Name: [Developer/Company Name]
Contact Email: [support-email@domain.com]

Thank you for your time and guidance!
```

---

## 4. Контактные данные и ссылки для App Store Connect

* **Support URL (URL службы поддержки):** `https://[your-domain.com]/support` *(или прямая ссылка на публичный GitHub репозиторий / Notion-страницу с контактом)*
* **Marketing URL (Маркетинговый URL):** `https://[your-domain.com]` *(необязательно)*
* **Privacy Policy URL (URL политики конфиденциальности):** `https://[your-domain.com]/privacy` *(обязательно — можно загрузить сгенерированный `PRIVACY_POLICY.md` на GitHub Pages, Notion или хостинг сайта)*
* **Copyright (Авторские права):** `2026 [Developer/Company Name]`
* **Primary Category (Основная категория):** `Health & Fitness` (Здоровье и фитнес)
* **Secondary Category (Вторичная категория):** `Lifestyle` (Образ жизни)
