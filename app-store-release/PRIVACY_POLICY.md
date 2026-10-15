# Политика конфиденциальности / Privacy Policy
**Приложение «Как я?» (EN: «How Am I?») — Трекер чувств и настроения**
*Дата последнего обновления / Effective Date: 13 октября 2026 г. / October 13, 2026*

---

## 🇷🇺 РУССКАЯ ВЕРСИЯ (RUSSIAN VERSION)

### 1. Введение и базовый принцип приватности
Настоящая Политика конфиденциальности регулирует порядок обработки информации в мобильном приложении **«Как я?»** (далее — «Приложение»), разработанном **[Developer/Company Name]** (далее — «Разработчик»).

Наш основополагающий принцип — **Zero-Data Collection (Полное отсутствие сбора данных)**. Приложение спроектировано в концепции *Local-First* и *On-Device Only*:
* Мы убеждены, что ваше эмоциональное состояние, переживания, мысли и заметки принадлежат только вам.
* Приложение не требует регистрации, не создает учетных записей, не запрашивает персональные данные (имя, номер телефона, адрес электронной почты) и не передает информацию на удаленные серверы.

Приложение полностью соответствует требованиям **Apple App Store Review Guidelines (в частности, пункту 5.1.1 Data Collection and Storage)**, Общему регламенту по защите данных ЕС (**GDPR**), Закону Калифорнии о конфиденциальности потребителей (**CCPA**) и Федеральному закону РФ № 152-ФЗ «О персональных данных».

---

### 2. Сбор и хранение пользовательских данных

#### 2.1. Данные об эмоциях, чекинах и контексте
Все сведения, которые вы вводите в Приложении:
* Выбранные эмоции и квадранты настроения (Mood Meter);
* Текстовые заметки и рефлексии;
* Контекстные теги (с кем вы находитесь, где вы находитесь, чем заняты);
* Временные метки чекинов и статистика использования,

**сохраняются исключительно локально в изолированной песочнице (App Sandbox) на вашем устройстве** с использованием защищенного локального хранилища (SwiftData / AsyncStorage). Разработчик не имеет технического доступа к вашей базе данных, не имеет серверов синхронизации и не передает эти данные третьим лицам.

#### 2.2. Отсутствие сбора метаданных и идентификаторов
Приложение:
* **НЕ запрашивает** рекламный идентификатор IDFA (Identifier for Advertisers) и не инициирует системный запрос App Tracking Transparency (ATT), так как отслеживание полностью отсутствует.
* **НЕ собирает** уникальные идентификаторы оборудования (UDID, MAC-адреса, IMEI).
* **НЕ собирает** геолокационные координаты GPS. Контекстный тег «Где вы» (например, «Дом», «Работа», «Природа») является лишь текстовой меткой, выбираемой вами вручную, и не обращается к службам CoreLocation.

---

### 3. Использование системных разрешений iOS

Приложение может запрашивать доступ к минимальному количеству системных функций iOS, работающих строго локально:

1. **Локальные уведомления (`UNUserNotificationCenter`):**
   * Разрешение используется исключительно для отправки локальных напоминаний о чекине (например, утренний или вечерний вопрос «Как вы себя чувствуете?»), настроенных вами.
   * Напоминания генерируются локальным таймером операционной системы вашего iPhone/iPad.
   * Приложение **не использует** внешние push-серверы (APNs Push Servers), не генерирует и не передает push-токены.

2. **Тактильный отклик (Haptic Feedback / Taptic Engine):**
   * При взаимодействии с плоскостью эмоций и интерфейсом задействуются встроенные системные вибромоторы iOS (`UIImpactFeedbackGenerator`).
   * Аппаратный отклик исполняется аппаратно «на лету» без сохранения каких-либо логов или аналитики.

---

### 4. Сторонние библиотеки, трекеры и аналитика
Приложение сознательно очищено от сторонних коммерческих SDK:
* **НЕТ сторонней рекламы:** Приложение не содержит рекламных сетей (Google AdMob, Unity Ads, AppLovin и т.д.).
* **НЕТ трекеров аналитики:** Мы не используем Google Analytics, Firebase Analytics, Meta/Facebook Pixel, AppsFlyer, Adjust, Amplitude или Mixpanel.
* **НЕТ сторонних трекинговых cookies.**

---

### 5. Экспорт и передача данных по инициативе пользователя
Приложение содержит функцию добровольного шеринга чекина («Поделиться карточкой настроения»). 
* Передача карточки или текста происходит исключительно по вашей прямой команде через стандартный системный диалог iOS (`UIActivityViewController` / System Share Sheet).
* Вы сами выбираете получателя (мессенджер, заметки, социальная сеть). В фоновом режиме никакие данные не передаются.

---

### 6. Контроль данных и право на удаление
В соответствии с нормами GDPR и CCPA вы обладаете полным суверенитетом над своими данными:
1. **Сброс внутри приложения:** В разделе «Настройки» доступна кнопка «Очистить историю чекинов», которая немедленно и безвозвратно удаляет локальную базу записей.
2. **Полное удаление с устройства:** Удаление Приложения со смартфона (деинсталляция) приводит к автоматическому уничтожению локальной песочницы данных операционной системой iOS. На серверах Разработчика не остается никаких резервных копий или следов, так как они изначально туда не поступали.

---

### 7. Конфиденциальность детей (Children's Privacy / COPPA)
Поскольку Приложение не собирает персональную информацию ни от одного пользователя, оно безопасно для использования лицами любого возраста, включая детей младше 13 лет (в соответствии с COPPA) и младше 16 лет (в соответствии с GDPR).

---

### 8. Изменения в Политике конфиденциальности
Мы оставляем за собой право обновлять настоящую Политику в случае изменения функционала Приложения или требований законодательства. Актуальная версия всегда публикуется внутри сборки Приложения и на официальной веб-странице проекта.

---

### 9. Контакты
Если у вас возникли вопросы, пожелания или предложения касательно нашей политики приватности:
* **Email разработчика:** `[support-email@domain.com]`
* **Правообладатель:** `[Developer/Company Name]`

---
---

## 🇺🇸 ENGLISH VERSION

### 1. Introduction & Core Privacy Commitment
This Privacy Policy governs the processing of information in the mobile application **"How Am I?" (Russian: «Как я?») — Mood & Feelings Tracker** (hereinafter referred to as the "App"), developed and published by **[Developer/Company Name]** (hereinafter referred to as the "Developer").

Our fundamental philosophy is **Zero-Data Collection / On-Device Only**:
* We firmly believe that your emotional states, private reflections, daily feelings, and journal entries belong solely to you.
* The App requires no registration, creates no accounts, does not ask for personal identity details (such as names, phone numbers, or email addresses), and does not transmit data to external servers or cloud infrastructure.

The App strictly complies with the **Apple App Store Review Guidelines (specifically Guideline 5.1.1 - Data Collection and Storage)**, the General Data Protection Regulation (**GDPR**), the California Consumer Privacy Act (**CCPA**), and the California Online Privacy Protection Act (**CalOPPA**).

---

### 2. User Data Handling & Local Storage

#### 2.1. Emotion Check-ins, Notes, and Contextual Metadata
All inputs created by the user within the App:
* Selected emotions and quadrants on the Mood Meter;
* Free-form text notes and reflections;
* Contextual tags (companions, locations, activities);
* Check-in timestamps and local statistical streaks,

**are stored exclusively on your physical device within the application's sandboxed storage environment (SwiftData / AsyncStorage)**. The Developer operates no backend servers, maintains no databases, and has no technological means or intention to access, view, or transfer your records.

#### 2.2. No Identifiers or Behavioral Tracking
The App:
* **Does NOT request** the Identifier for Advertisers (IDFA) and does not prompt for App Tracking Transparency (ATT) permission, as no cross-app or cross-site tracking takes place.
* **Does NOT collect** hardware identifiers (UDID, MAC address, IMEI).
* **Does NOT access** GPS or location hardware (`CoreLocation`). Contextual tags such as "Home" or "Work" are purely self-selected visual tags that do not reference geographic coordinates.

---

### 3. Device Permissions & System Capabilities

The App utilizes an absolute minimum of local iOS system capabilities:

1. **Local Notifications (`UNUserNotificationCenter`):**
   * Used exclusively to schedule on-device check-in reminders (e.g., gentle morning or evening prompts) configured by the user.
   * Reminders are calculated and dispatched directly by the local iOS system clock.
   * The App **does not use** external Apple Push Notification service (APNs) servers, nor does it generate, harvest, or store remote device push tokens.

2. **Haptic Feedback (`UIImpactFeedbackGenerator`):**
   * Delivers tactile responses during emotional plane navigation.
   * Executed locally by Apple's Taptic Engine hardware with zero logging or behavioral tracking.

---

### 4. Third-Party Services, SDKs, and Trackers
The App is built with an uncompromising commitment to clean, tracker-free code:
* **No Third-Party Advertising:** No ad networks (such as Google AdMob, Unity, AppLovin).
* **No Analytics SDKs:** No Google Analytics for Firebase, Meta/Facebook Pixel, AppsFlyer, Adjust, Mixpanel, or Amplitude.
* **No Web Cookies or Tracking Pixels.**

---

### 5. User-Initiated Data Sharing
The App includes an optional feature allowing users to share an emotion summary card with friends or family.
* Any export is initiated purely upon your explicit trigger via the native iOS Share Sheet (`UIActivityViewController`).
* You retain absolute choice over the recipient and transmission channel. No background transmission or telemetry occurs.

---

### 6. Data Sovereignty and Deletion Rights
In accordance with GDPR, CCPA, and global privacy standards, you maintain absolute sovereignty over your records:
1. **In-App Reset:** In the App Settings, a "Clear All Check-ins" action permanently and irrecoverably erases your local database.
2. **App Uninstallation:** Deleting the App from your device immediately purges the entire sandbox database managed by iOS. Because no data was ever transmitted off-device, no residual traces remain on any external server.

---

### 7. Children’s Privacy (COPPA & GDPR-K Compliance)
Because the App does not collect, store, or transmit personal data from any individual, it is fully compliant with the Children’s Online Privacy Protection Act (COPPA) and Article 8 of GDPR. It is completely safe for audiences of all ages, including children under 13.

---

### 8. Amendments to This Policy
We reserve the right to revise this Privacy Policy to reflect future updates or evolving regulatory requirements. The latest version will always be accessible within the App interface and on the designated support URL.

---

### 9. Contact Information
For any inquiries regarding this Privacy Policy or privacy architecture, please contact:
* **Support Email:** `[support-email@domain.com]`
* **Developer / Legal Entity:** `[Developer/Company Name]`
