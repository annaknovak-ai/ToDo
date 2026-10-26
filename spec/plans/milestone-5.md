# תוכנית – Milestone 5: התאמה חזותית, PWA ובדיקת מוצר מלאה

**מקורות:** `MILESTONES.md` (Milestone 5), `PRD.md` (3.ג, FR-10, 4.ב–4.ג, 5.א), `ARCHITECTURE.md` (2.7–2.10, ADR-4, ADR-10, ADR-11, ADR-12), `DESIGN.md` (כולו), `wireframes.png`, `style-guide.png`, `mockups1.png`, `mockups2.png`.

**אין שינוי במבנה מסד הנתונים** ואין Migration חדשה. אין משתני סביבה חדשים ב-`.env`. בדיקת ה-Production (סעיף 6) מקבלת את כתובת האתר החי בשורת הפקודה בלבד.

## 1. הגישה בקצרה

- **ליטוש חזותי** – בעיקר `src/styles.css`, ועוד שני אייקונים קטנים (הוספה, מחיקה). אין שינוי בהתנהגות, בזרימות או ב-API.
- **PWA** – Manifest ואייקונים, **ללא Service Worker** (ADR-10). האייקונים נוצרים פעם אחת מקובץ SVG ונשמרים ב-Git.
- **מצב לא מקוון** – פס הודעה קבוע בשני הדפים כשאין חיבור (ADR-10). שום מנגנון אינו שומר משימות במכשיר.
- **בדיקות** – השלמת E2E לזרימות שעדיין חסרות, PWA ו-Offline, בדיקת פריסה (Layout) בדסקטופ ובמובייל, ובדיקת קריאה בלבד מול Production אחרי הדחיפה.
- **לא ממומש** מתוך ה-Mockups: כותרת "To Do", תפריט המבורגר, "הגדרות", תפריט ⋮, תאריך/תיאור בשורת הרשימה, פסי צבע, "נוצר בתאריך"/"עודכן לאחרונה", כפתור "ערוך משימה" ואיור הלוח בהודעת "בחר משימה" (DESIGN 2.3–2.4: ללא עיטורים ותוספות).

## 2. התאמה חזותית (`src/styles.css` ורכיבים)

הבסיס (Tokens, פריסה דו-עמודתית, עמודה אחת במובייל) כבר קיים מ-Milestones 1–4. בשלב הזה משווים כל מסך לתמונות ומתקנים פערים:

### 2.1 כפתורים (Style Guide → Buttons)
- **Primary:** כחול, טקסט לבן, Hover כהה יותר (קיים).
- **Secondary:** לבן עם מסגרת כחולה, Hover רקע תכלת בהיר (קיים).
- **Danger – "מחק משימה":** לפי ה-Style Guide כפתור **מסגרת אדומה וטקסט אדום על רקע לבן** (כיום מלא באדום). Hover: רקע אדום בהיר מאוד. כפתור **"אישור"** בחלון המחיקה נשאר מלא באדום, כפעולה הסופית.
- **Disabled:** אפור בהיר וטקסט לבן (קיים), גם ל-Danger.
- אייקון קו `+` בכפתור **"הוסף משימה"** שבדף הבית, ואייקון פח בכפתור **"מחק משימה"** – SVG בתוך הרכיב, `aria-hidden`, כך ששם הכפתור לא משתנה (הבדיקות הקיימות ממשיכות לעבוד).

### 2.2 שדות קלט (Style Guide → Input Fields)
- רקע לבן, גבול אפור בהיר, פינות 8px, Placeholder אפור (קיים).
- **Focus:** מסגרת כחולה במקום קו מתאר חיצוני עבה, כמו ב-Mockup של חלון ההוספה.
- **שדה תאריך:** לבדוק בצילום מסך ש-`2026-12-20` מוצג בסדר תקין בתוך ממשק RTL; אם הסדר מתהפך – `direction: ltr` לשדה עצמו עם יישור לימין (DESIGN 2.5: "סדר תווים תקין").

### 2.3 רשימה ושורות (Style Guide → Cards / List Items)
- השורה הנבחרת: רקע תכלת עדין (קיים). Hover אפור עדין (קיים).
- **Checkbox במובייל:** השארת הריבוע 20px, אבל הגדלת אזור הלחיצה ל-44×44px (בלי להזיז את הטקסט), כדי שלחיצה באצבע לא תפספס ולא תבחר את השורה בטעות.
- ידית הגרירה כבר 40×40px – להגדיל ל-44px במובייל.
- טקסט ארוך נקטע בשלוש נקודות (קיים) – לבדוק עם טקסט עברי ארוך במובייל.

### 2.4 הודעות (Style Guide → States & Feedback)
- הודעת הצלחה ושגיאה: רקע עדין, גבול, ואייקון עגול קטן (✓ ירוק / ! אדום) בתחילת ההודעה, כמו ב-Style Guide. האייקון ב-CSS (`::before`) – ללא שינוי בטקסט שהבדיקות מחפשות. **ללא** כפתור ✕ לסגירה: לא מוגדר ב-PRD.
- פס ההודעה מעל הרשימה (ADR-20) ופס ה-Offline (סעיף 4) באותו סגנון שגיאה.

### 2.5 ניווט
- שני קישורים בלבד, הפעיל בכחול עם קו תחתון ורקע עדין (קיים).
- **מובייל:** שני הקישורים מתחלקים שווה ברוחב המסך (DESIGN 1.6: "ניווט מותאם לרוחב המסך").

### 2.6 דף הבית במובייל (Wireframe "דף הבית – מובייל")
- ב-Wireframe של המובייל אין כותרת "המשימות שלי": הסדר הוא ניווט ← כפתור "הוסף משימה" ברוחב מלא ← רשימה ← פרטים. הכותרת תוסתר חזותית במובייל בלבד (נשארת לקוראי מסך). *זה שינוי מראה קטן מול מה שנבנה עד היום – לפי כלל הקדימויות ה-Wireframes קובעים מבנה.*
- כפתורי "שמור שינויים" / "מחק משימה" זה לצד זה, כל אחד חצי רוחב (כמו ב-Wireframe), במקום אחד מתחת לשני.

### 2.7 Modal
- בדיקה במסך צר: החלון לא חורג מהמסך, נגלל בתוכו אם המקלדת פתוחה (`max-height` + `overflow-y: auto`), והכפתורים זה לצד זה.
- חלון המחיקה: כותרת, שאלה וכפתורי "ביטול"/"אישור" – כמו ב-Wireframe (קיים).

### 2.8 דף אודות
- כרטיס לבן ממורכז עם כותרת "אודות" ופסקה (קיים). רק בדיקה מול ה-Wireframe.

### 2.9 צילומי מסך להשוואה
בסוף שלב העיצוב יצולמו (Playwright) ששת מצבי ה-Wireframe בדסקטופ ובמובייל, לתיקייה `test-results/` (לא ב-Git), ויושוו לתמונות. אלה לא בדיקות אוטומטיות שנכשלות – רק לעיון שלי ושלך.

## 3. PWA (ADR-10)

### 3.1 קבצים חדשים
- `public/icons/icon.svg` – אייקון פשוט: ריבוע מעוגל כחול `#2F80ED` ובו סימן ✓ לבן ושלוש שורות של רשימה. משמש גם כ-Favicon.
- `public/icons/icon-maskable.svg` – אותו ציור עם שוליים רחבים (אזור בטוח ~80%), רקע מלא.
- `scripts/generate-icons.ts` – פותח את ה-SVG ב-Chromium של Playwright (כבר מותקן בפרויקט, ADR-11) ושומר PNG: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. מורץ פעם אחת ב-`npm run icons`; ה-PNG נשמרים ב-Git.
- `public/manifest.webmanifest`:
  - `name`: "רשימת משימות משותפת", `short_name`: "משימות"
  - `start_url`: "/", `scope`: "/", `display`: "standalone"
  - `lang`: "he", `dir`: "rtl"
  - `background_color`: `#EAF6FF`, `theme_color`: `#2F80ED`
  - `icons`: 192 ו-512 (`purpose: any`), ו-512 `maskable`.

### 3.2 שינויים
- `index.html`: `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">` (`theme-color` כבר קיים).
- `vercel.json`: ה-Rewrite כבר אינו תופס נתיבים עם נקודה (ADR-12), כך שה-Manifest והאייקונים יוגשו כפי שהם. להוסיף `headers` ל-`/manifest.webmanifest` עם `Content-Type: application/manifest+json` רק אם בבדיקה יתברר שהסוג שגוי.
- **אין Service Worker** ואין קוד שרושם אחד.

## 4. מצב לא מקוון

- `src/lib/useOnlineStatus.ts` – Hook קטן: `navigator.onLine` + אירועי `online`/`offline`.
- `src/components/OfflineBanner.tsx` – כשאין חיבור מוצג מתחת לניווט, בשני הדפים, פס `role="alert"` עם הנוסח מ-PRD: **"אין חיבור לאינטרנט. לא ניתן לצפות במשימות או לשנות אותן עד שהחיבור יחזור."** נעלם כשהחיבור חוזר. מורכב ב-`App.tsx`.
- **התנהגות פעולות:** כפי שנקבע ב-ADR-10 – פעולה בלי חיבור נכשלת בבקשת הרשת, וכבר היום (`apiErrors.ts`) מוצגת הודעת "אין חיבור" והמצב חוזר לקדמותו (Checkbox, סדר, טופס). אין תור פעולות ואין שמירה מקומית.
- **רשימה שכבר מוצגת:** נשארת על המסך עם פס ה-Offline מעליה, כך שברור שהיא לא מתעדכנת. Refresh בלי חיבור מציג את דף "אין אינטרנט" של Chrome (אין Service Worker) – כלומר אין דרך להציג רשימה שמורה.
- **אחסון:** לוודא שאין שימוש ב-`localStorage`/`sessionStorage`/IndexedDB/Cache Storage בקוד (חיפוש בקוד + בדיקת E2E, סעיף 5).

ADR חדש יתועד: **ADR-22 – פס Offline גלובלי** (Hook + רכיב ב-`App`, הרשימה המוצגת נשארת עם הפס, ללא חסימה מוקדמת של כפתורים).

## 5. בדיקות

### 5.1 Unit / Component (`npm test`)
- `useOnlineStatus` / `OfflineBanner`: מופיע באירוע `offline`, נעלם ב-`online`.
- `App.test.tsx`: הפס מוצג גם בדף הבית וגם באודות.
- בדיקה שה-Manifest (קריאת הקובץ) כולל את כל השדות הנדרשים והאייקונים קיימים בגדלים הנכונים.

### 5.2 E2E חדשות (`npm run test:e2e`, Desktop + Mobile Chrome מול Dev)
- `tests/e2e/pwa.spec.ts`:
  - `link[rel=manifest]` קיים; ה-Manifest נטען (200) עם השדות הנדרשים; כל אייקון נטען (200, `image/png`, בגודל המוצהר).
  - Chrome מאשר שהאתר ניתן להתקנה: `Page.getInstallabilityErrors` דרך CDP מחזיר רשימה ריקה (localhost נחשב מאובטח, כמו HTTPS).
  - אין Service Worker רשום (`navigator.serviceWorker.getRegistrations()` ריק) ואין Cache Storage.
- `tests/e2e/offline.spec.ts`:
  - `context.setOffline(true)` ← הפס מופיע בדף הבית ובאודות; `setOffline(false)` ← נעלם.
  - בלי חיבור: Checkbox חוזר למצבו + הודעה; שמירת עריכה / יצירה נכשלות והטקסט נשאר בטופס; הנתונים במסד לא השתנו.
  - טעינה מחדש בלי חיבור לא מציגה רשימת משימות. אחרי חזרת החיבור ו-Refresh הרשימה המלאה חוזרת מהשרת.
  - `localStorage`, `sessionStorage` ו-IndexedDB ריקים אחרי כל הזרימות.
- `tests/e2e/layout.spec.ts`:
  - דסקטופ: רשימה מימין, פרטים משמאל; רשימה ארוכה נגללת בתוך האזור שלה והפרטים נשארים גלויים.
  - מובייל: עמודה אחת, רשימה מעל פרטים, אין גלילה אופקית בשום מסך (כולל Modal פתוח); בחירה גוללת לפרטים.
  - `dir="rtl"` ו-`lang="he"` בדף; כפתורים ושדות בתוך גבולות המסך.
- `tests/e2e/journey.spec.ts` – זרימה אחת מלאה מקצה לקצה: כניסה ← הוספה ← עריכה ושמירה ← סימון השלמה ← גרירה ← מעבר לאודות וחזרה ← Refresh (הכול נשמר) ← מחיקה. רצה בשני המצבים (במובייל הגרירה במגע, כמו ב-`reorder.spec.ts`).
- "מספר חלונות": שני `BrowserContext` נפרדים – שינוי באחד מופיע בשני רק אחרי Refresh (קיים חלקית ב-M2/M4 – להשלים לעריכה ולמחיקה).

### 5.3 רגרסיה
- כל הבדיקות הקיימות: `npm test`, `npm run test:integration`, `npm run test:e2e`, ו-`npm run build` + `npm run typecheck`.
- בדיקה שאין סודות בתוצר: חיפוש ב-`dist/` אחרי `DATABASE_URL`, `postgres://` ושם המשתמש `app_backend` – חייב להיות ריק.
- סקירה של `server/tasksRepository.ts`: כל השאילתות עם פרמטרים (`$1`...) ובלי שרשור מחרוזות.

### 5.4 בדיקות ידניות (על ידך, בטלפון Android)
- התקנת האתר כאפליקציה מ-Chrome (תפריט ⋮ ← "הוספה למסך הבית" / "התקנת אפליקציה"), פתיחה מהאייקון במסך מלא בלי שורת כתובת.
- גרירה באצבע בטלפון אמיתי.
- מצב טיסה: הופעת הפס, ופעולה שנכשלת עם הודעה.
- אפשר לבדוק את ההתקנה רק **אחרי הדחיפה** (צריך HTTPS אמיתי). אסביר צעד אחר צעד.

## 6. Production (אחרי הדחיפה)

- `playwright.prod.config.ts` + `tests/prod/smoke.spec.ts` – **קריאה בלבד** (ADR-11): דף הבית נטען ומציג רשימה (או מצב ריק), `GET /api/tasks` מחזיר 200 עם `Cache-Control: no-store`, ניווט ו-Refresh ב-`/about`, Manifest ואייקונים נטענים ב-HTTPS, Chrome מאשר שניתן להתקין. אין יצירה, עריכה או מחיקה מול Production.
- הרצה: `npm run test:prod` עם כתובת האתר החי שתמסור לי (משתנה `PROD_URL` בשורת הפקודה, לא ב-`.env`).
- אימות שה-Deployment ב-Vercel הצליח אוטומטית מה-Push (בלי פריסה ידנית).
- לפי כללי העבודה, תנאי ה-Definition of Done שתלויים בפריסה יסומנו בסיום הבנייה כ"ממתינים לדחיפה" ויאומתו מיד אחריה.

## 7. קבצים

**חדשים:** `public/manifest.webmanifest`, `public/icons/icon.svg`, `public/icons/icon-maskable.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `scripts/generate-icons.ts`, `src/lib/useOnlineStatus.ts`, `src/components/OfflineBanner.tsx` (+ בדיקה), `tests/e2e/pwa.spec.ts`, `tests/e2e/offline.spec.ts`, `tests/e2e/layout.spec.ts`, `tests/e2e/journey.spec.ts`, `playwright.prod.config.ts`, `tests/prod/smoke.spec.ts`.

**משתנים:** `src/styles.css`, `index.html`, `src/App.tsx`, `src/pages/HomePage.tsx` (אייקון בכפתור), `src/components/TaskDetails.tsx` (אייקון, סגנון Danger), `src/components/TaskRow.tsx` (אזור לחיצה), `package.json` (`icons`, `test:prod`), `spec/ARCHITECTURE.md` (ADR-22), `spec/MILESTONES.md` (🟡 בסיום), `CLAUDE.md` (פקודות הרצה: `test:prod`), ואם צריך `vercel.json`.

## 8. סדר עבודה

1. Manifest, אייקונים ו-`index.html`; בדיקת התקנה ב-CDP.
2. Hook ופס Offline + בדיקות Unit.
3. ליטוש CSS ואייקונים בכפתורים; צילומי מסך והשוואה לתמונות; תיקונים.
4. בדיקות E2E חדשות; הרצת כל הבדיקות הקיימות ותיקון כשלים.
5. בדיקות אבטחה (סודות בתוצר, SQL פרמטרי).
6. ADR-22, עדכון `CLAUDE.md` וסימון 🟡.
7. אחרי אישור ודחיפה: `npm run test:prod` מול האתר החי + הדרכה לבדיקה בטלפון.

## 9. Definition of Done – איך כל תנאי ייבדק

| תנאי | בדיקה |
|---|---|
| תאימות ל-Wireframes ול-Style Guide, ללא UI נוסף | צילומי מסך (2.9) + `layout.spec.ts` + רשימת ה"לא ממומש" בסעיף 1 |
| RTL, תאריכים ועברית; פריסה בדסקטופ ובמובייל | `layout.spec.ts`, צילומי מסך, בדיקת שדה התאריך |
| כל הזרימות End-to-End | `journey.spec.ts` + כל קובצי ה-E2E הקיימים, בשני המצבים |
| PWA ב-Chrome Android, Manifest ו-HTTPS | `pwa.spec.ts` מקומית, `smoke.spec.ts` ב-Production, התקנה ידנית בטלפון |
| ניתוק רשת ללא נתונים שמורים | `offline.spec.ts` + בדיקה ידנית במצב טיסה |
| פרטי DB מחוץ ללקוח, Validation בשרת, SQL פרמטרי | חיפוש ב-`dist/`, סקירת Repository, בדיקות Unit/Integration קיימות |
| Build, API, Integration, E2E; Drag & Drop במגע; פריסה אוטומטית | כל פקודות הבדיקה + בדיקה ידנית בטלפון + Deployment מה-Push |
| הדגמה ותוצאות, עצירה לאישור סופי | סיכום בסוף הבנייה, ושוב אחרי בדיקת Production |
