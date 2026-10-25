# ARCHITECTURE – אתר TODO List משותף

**בסיס:** `PRD.md` | **תאריך מחקר:** 12.10.2026 | **שפת מסמך:** עברית

## 1. Technology Stack שנבחר

| רכיב | טכנולוגיה | תפקיד |
|---|---|---|
| שפת פיתוח | TypeScript | טיפוסים משותפים ל-Frontend ול-Backend |
| Frontend | React + Vite | אפליקציית Web מסוג SPA, עם Build סטטי |
| עיצוב | CSS רגיל ו-Responsive CSS | ממשק עברי RTL למחשב ולמובייל, ללא Framework עיצוב נוסף |
| ניווט | React Router | שני נתיבים: `/` ו-`/about` |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` | שינוי סדר במחשב וב-Android Touch; Sensors ו-Drag Handle נפרד |
| PWA | Web App Manifest ו-HTTPS; Service Worker אופציונלי ומוגבל | התקנה ב-Chrome על Android; ללא Offline Data או סנכרון ברקע |
| Backend | Node.js + TypeScript באמצעות Vercel Functions | REST API, Validation, לוגיקה עסקית וכתיבה מאובטחת למסד הנתונים |
| גישה ל-Database | `pg` (node-postgres), SQL פרמטרי | גישה ישירה ל-PostgreSQL מתוך השרת; Transactions לשינוי סדר |
| Database | Supabase PostgreSQL | אחסון קבוע של רשימה משותפת אחת |
| Database Migrations | קובצי SQL ב-Git; Supabase CLI מול Dev; Supabase GitHub Integration מול Production | ניהול Schema מבוקר ובר-שחזור; החלה אוטומטית על Production בעת Push |
| אחסון קוד | GitHub | Repository יחיד עבור האפליקציה, API ו-Migrations |
| Hosting ו-Deployment | Vercel, מחובר ל-GitHub | Build ופריסה אוטומטיים של Frontend ו-Serverless API, באותו Origin |
| בדיקות | Vitest, React Testing Library, Playwright | בדיקות של לוגיקה, UI ותרחישי משתמש ב-Chrome |

### החלטות ונימוקים

- **React + Vite** נבחרו במקום Next.js או Vue: האתר כולל שני דפים, רשימה וטפסים בלבד; אינו דורש SSR, SEO דינמי או מנגנון Full-Stack מורכב. React מספק Ecosystem גדול ודוגמאות רבות לפיתוח בעזרת AI; Vite מפיק Build סטטי שקל לפרוס. Vercel תומכת ב-Vite ובתיקיית `api` עבור Functions [1].
- **Node.js Functions נפרדות, ללא Express**: מספר פעולות CRUD קטן ואפשר לממשו ב-Handlers קצרים. אין צורך בשרת קבוע, WebSocket או תשתית Background Jobs. Vercel Functions תומכות ב-Node.js ויש להן מגבלות זמן, זיכרון ועלות שיש לכבד [2].
- **PostgreSQL ב-Supabase**, ולא MongoDB או SQLite בדפדפן: נתונים מובנים, סדר משותף ו-Transactions הם התאמה טבעית למסד רלציוני. SQLite מקומי אינו נותן מסד משותף מנוהל בין כל המבקרים. Supabase מספקת PostgreSQL מנוהל ו-Migrations [3][4].
- **`pg` עם SQL ישיר**, במקום Prisma או ORM נוסף: עבור טבלה עיקרית אחת, SQL פשוט מצמצם תלות ומורכבות. `pg` תומך ב-Transactions מפורשים ומאפשר להריץ את כל הפעולות באותה Transaction [5].
- **dnd-kit** נבחר במקום HTML Drag and Drop בלבד או ספריית גרירה כבדה: הוא תומך ב-Sortable וב-Touch/Pointer; יש להגדיר Drag Handle ברור כדי שגרירה לא תתנגש בלחיצה על שורה או Checkbox [6].
- **Vercel + Supabase** עדיפים כאן על GitHub Pages בלבד, משום שנדרש Backend ומסד נתונים אמיתי. אין צורך ב-Supabase Auth, Realtime, Storage או Edge Functions.
- **אין צורך ב-Authentication, AI, קבצים, Analytics, Redis, Queue, Notifications או שירותי אינטגרציה**: אינם חלק מה-PRD.

### עלויות, מגבלות וסיכונים

- Vercel Hobby היא תוכנית חינמית **לשימוש אישי לא-מסחרי בלבד**. שימוש מסחרי מחייב Pro או מסלול מתאים אחר. המחיר המפורסם של Vercel Pro מתחיל ב-**$20 לחודש** בכפוף לתמחור ולשימוש בפועל [7][8].
- Supabase מציעה Free Plan לצורכי פיתוח וניסוי, אך פרויקטים שאינם פעילים מספיק עשויים להיעצר. Pro מתחילה ב-**$25 לחודש** לפני עלויות נוספות לפי השימוש [9][10]. בהיעדר תקציב שהוגדר ב-PRD לא נקבע מסלול בתשלום מראש. המחירים והמכסות עשויים להשתנות. **סיכון שהתקבל:** בחשבון ה-Supabase של המשתמש אין פרויקטים פעילים אחרים, ושני הפרויקטים (Dev ו-Production) ינצלו את מכסת התוכנית החינמית. המשתמש מקבל את האפשרות שהאתר החי ייעצר לאחר תקופה ללא שימוש; במקרה כזה המשתמש מפעיל מחדש את הפרויקט מלוח הבקרה של Supabase (Restore project), והנתונים נשמרים.
- בהיות האתר **ציבורי ללא התחברות**, כל מבקר יכול לראות, לשנות ולמחוק את כל המשימות. הגנה מלאה מפני שימוש זדוני אינה אפשרית ללא שינוי בדרישות המוצר. נדרשים Rate Limiting ברמת התשתית ככל שזמין, הגבלות גודל בקשות, Validation והגבלת משאבים; אפשרויות הגנה בתשלום אינן מובטחות בתוכנית חינמית. **סיכון שהתקבל:** המשתמש מקבל את האפשרות שמבקר זדוני ימחק או ישנה את כל המשימות, ושבתוכנית החינמית לא יהיה גיבוי לשחזור. לא יתווספו לשם כך מנגנוני הגנה או גיבוי מעבר לנדרש במסמך זה.
- שימוש ב-Vercel Functions מחייב חיבור מתאים למסד בתצורת Serverless: Supabase ממליצה על **Transaction Pooler** וחיבורי Client מצומצמים [3].
- אין עדכונים בין מבקרים בזמן אמת. העריכה היא `last write wins`; רשימה שנשארה פתוחה בדפדפן עלולה להיות לא עדכנית. פרטים על אופן טיפול בשינוי סדר מפורטים בהמשך.
- PWA **אינה שקולה ל-Offline**. Manifest ו-HTTPS מאפשרים התקנה במכשירים תומכים, ללא שמירת משימות בצד הלקוח [11].

## 2. ארכיטקטורת המערכת

### 2.1 מבנה ורכיבים

```text
Chrome Desktop / Chrome Android (PWA)
                 │ HTTPS / Same Origin
                 ▼
          Vercel Deployment
          ├── Static Frontend (React + Vite)
          │   ├── Home: list + details + create modal
          │   └── About + shared navigation
          └── /api/*: Vercel Node.js Functions
              ├── Request Validation
              ├── Tasks Service / Business Rules
              └── PostgreSQL queries + Transactions
                            │ TLS / pooled connection
                            ▼
                     Supabase PostgreSQL
                         public.tasks
```

**אחריות Frontend:** הצגת הרשימה, בחירת משימה, טפסים ו-Validation ראשוני, מצבי טעינה ושגיאה, Modal לאישור מחיקה, Drag & Drop וניווט. מצב UI זמני נשמר בזיכרון React בלבד. בקשות נשלחות ל-API דרך נתיבים יחסיים (`/api/...`); אין גישה ישירה מהדפדפן ל-PostgreSQL.

**אחריות Backend:** בדיקת Method ו-Payload, Validation מחייב, CRUD, שינוי סטטוס, שינוי סדר אטומי, טיפול בשגיאות והחזרת JSON עקבי. כל גישה ל-Database עוברת דרכו. אין Session או מידע על זהות המבקר.

**אחריות Database:** שמירה קבועה של משימות, Constraints, מיקום תצוגה, ו-Transactions. רשימה משותפת אחת בלבד.

### 2.2 Modules לוגיים

- **Pages / Navigation:** `Home`, `About`, תפריט זהה בשני הדפים; `React Router` עם RTL גלובלי.
- **TaskList:** טעינה, Empty/Error/Loading states, שורות עם Checkbox, טקסט מקוצר, בחירה וסדר ידני.
- **TaskDetails:** כותרת, תיאור ותאריך יעד כשדות Editable מיד עם הבחירה; לחצן `שמור שינויים` ו-`מחק משימה`. ללא בחירה: `בחר משימה מהרשימה כדי לצפות בפרטיה`.
- **CreateTaskModal:** כותרת ותיאור ריקים, תאריך יעד שהוגדר להיום, ניתנים לניקוי; `הוסף משימה`, ביטול ללא התראה; נתוני Modal נמחקים בסגירה ללא שמירה.
- **Task API Client:** עטיפת `fetch`, טיפול ב-HTTP Errors ועידכון State **רק לאחר הצלחה** בפעולות שמשנות מסד; בהשלמה/גרירה מותר UI אופטימי בתנאי Rollback בשגיאה.
- **Server Tasks Service:** כללי Validation, CRUD, סדר ושמירת סטטוס; **Repository** קטן עם SQL פרמטרי.

אין צורך ב-State Manager גלובלי נוסף, ב-React Query או ב-Service Layer רב-שכבתי. State משותף בדף הבית באמצעות React Hooks מספיק.

### 2.3 Data Model

טבלה מרכזית אחת: **`public.tasks`**.

| שדה | PostgreSQL Type | פירוש/כללים |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | מזהה משימה |
| `title` | `varchar(100) NULL` | כותרת; `NULL` בהיעדר כותרת |
| `description` | `varchar(2000) NULL` | תיאור; `NULL` בהיעדר תיאור |
| `due_date` | `date NULL` | תאריך יעד ללא זמן |
| `completed` | `boolean NOT NULL DEFAULT false` | מצב השלמה |
| `position` | `integer NOT NULL` | מיקום ברשימה, החל מ-0 |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Metadata פנימי |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Metadata פנימי שמתעדכן בכתיבה |

**Constraints:**
- לפחות אחד מהשדות `title` ו-`description` חייב להכיל תווים שאינם White Space (בצד Backend לאחר `trim`, וגם אילוץ DB מתאים). רווחים בלבד אינם תקינים.
- מגבלות אורך נאכפות בצד Backend ובסוגי העמודות. אין צורך בחשיפת `created_at`/`updated_at` בממשק.
- `position >= 0`. אינדקס על `(position, id)` לטעינה בסדר יציב. ניתן לנרמל מיקומים רציפים בעת כל שינוי סדר; **אין צורך באילוץ UNIQUE על position**, כדי לאפשר עדכוני סדר אטומיים בלי התנגשויות זמניות.
- `due_date` נבדק בצד השרת מול התאריך הנוכחי (היום או עתיד) **ביצירה, ובעדכון רק כאשר הערך שנשלח שונה מהערך השמור**. ב-`PATCH` השרת משווה את `dueDate` שהתקבל ל-`due_date` השמור; אם הם זהים, בדיקת העבר אינה מופעלת, כך שמשימה שתאריך היעד שלה כבר עבר ניתנת לעריכה. תאריך יעד קיים שהפך לעבר עם חלוף הזמן נשאר חוקי כנתון שמור; לא מוחקים או משנים אותו אוטומטית. אותו כלל חל ב-Validation בצד הלקוח.
- **תקרת משימות:** עד 1,000 משימות ברשימה. השרת סופר את המשימות בתוך ה-Transaction של היצירה, תחת אותה נעילה המשמשת לשינויי מבנה הרשימה (ראו 2.6), ודוחה יצירה כאשר כבר קיימות 1,000; כך שתי יצירות מקבילות אינן יכולות לחרוג מהתקרה. הלקוח מונע פתיחת יצירה כאשר ברשימה שבידיו 1,000 משימות, אך הבדיקה המחייבת היא בשרת.
- אין Users, Accounts או קשרי Foreign Key נוספים. ה-Database אינו שומר טיוטות או מצב PWA.

**החלטת יישום לגבי 'היום':** בטופס התאריך מוצג לפי התאריך המקומי של המכשיר, כדרישת חוויית המשתמש. לצורך Validation מחייב ועקבי בשרת יש להשתמש ב-Timezone מוסכם של המוצר; בהיעדר הגדרה עסקית במסמך המקור, **מוצעת כהנחת יישום `Asia/Jerusalem`**. אם המוצר מיועד למשתמשים באזורי זמן שונים, נדרש להחליט על כלל עסקי מוסכם לפני קיבוע מדיניות תאריכים; אין להסתמך על השעה של מכונת ה-Serverless או על `Date.toISOString()` כתחליף לתאריך מקומי.

### 2.4 REST API

כל בקשה והתגובה שלה הן JSON; כתובות יחסיות, באותו Origin. פעולות שינוי אינן נחשפות דרך GET.

| Method | Path | פעולה | Body עיקרי |
|---|---|---|---|
| `GET` | `/api/tasks` | רשימת כל המשימות לפי `position ASC, id ASC` | — |
| `POST` | `/api/tasks` | יצירת משימה בסוף הרשימה, בסטטוס `completed=false` | `{title, description, dueDate}` |
| `PATCH` | `/api/tasks/:id` | עדכון שדות המשימה הניתנים לעריכה | `{title, description, dueDate}` – שלושתם יחד |
| `PATCH` | `/api/tasks/:id/status` | החלפת סטטוס בהתאם לערך מפורש | `{completed: boolean}` |
| `PUT` | `/api/tasks/order` | החלפת סדר הרשימה | `{orderedIds: string[]}` |
| `DELETE` | `/api/tasks/:id` | מחיקת משימה | — |

**כללי חוזה:**
- `title`, `description` יכולים להיות `null` או מחרוזת; השרת שומר את הערך לאחר `trim`, וערך ריק מנורמל ל-`null`. `dueDate` הוא `YYYY-MM-DD` או `null`; לא Timestamp.
- `POST` מחזיר `201` ואת הרשומה החדשה; `PATCH` ו-`PUT` מחזירים `200` עם המשימה/הסדר המעודכנים; `DELETE` מחזיר `204`; `GET` מחזיר `200` עם מערך (גם אם ריק).
- `400`/`422`: קלט לא תקין, עם `{error: {code, message, field?}}` והודעה בעברית; `404`: משימה לא קיימת; `409`: סדר לא תואם את רשימת המשימות הנוכחית, או יצירה כאשר הרשימה מלאה (`code: TASK_LIMIT_REACHED`); `429`: יותר מדי בקשות, כאשר זמין Rate Limit; `500`/`503`: תקלה זמנית.
- שרת מגביל `Content-Type`, גודל Body, אורכי מחרוזות ומספר מזהי המשימות במערך הסדר (עד 1,000). IDs נבדקים כ-UUID. SQL תמיד Parameterized. אין לקלוט או להחזיר HTML כ-HTML; React מציג טקסט משתמש כטקסט בלבד.
- כל תשובת `GET /api/tasks` צריכה להימנע מ-Cache של תוכן המשתנה (`Cache-Control: no-store`), כדי שטעינה מחדש אכן תראה את המצב הנוכחי. לא משתמשים ב-SWR, Polling או WebSocket.

### 2.5 זרימות מידע והתנהגות

**טעינת דף הבית:** React מבצע `GET /api/tasks`; מציג את כל המשימות לפי הסדר השמור. בתחילה אין בחירה. שינויי מבקרים אחרים אינם נשלחים לדף פתוח; כניסה מחדש או Refresh מבצעים GET חדש.

**יצירה:** פתיחת Modal מאפסת טופס; Validation בצד הלקוח; `POST`; השרת מאמת שוב, בודק את תקרת 1,000 המשימות, מקצה `position` בקצה הרשימה, שומר ומחזיר רשומה; UI מעדכן רשימה, סוגר Modal ובוחר את המשימה החדשה כך שפרטיה מוצגים. כישלון משאיר את הערכים ומציג הודעה בתוך הטופס.

**עריכה:** בחירה טוענת עותק מקומי לעריכה. `PATCH` נשלח **רק בלחיצה** על `שמור שינויים`. החלפת משימה, ניווט או Refresh מבטלים ערכים מקומיים בלי התראה. לא נשמרת טיוטה ב-Local Storage. השרת שומר לפי `last write wins` בשדות העריכה; `status` ו-`position` אינם חלק מבקשת עריכת הפרטים, כדי לא לדרוס אותם בטעות. שינוי סטטוס או גרירה של המשימה הנבחרת מעדכנים רק את `completed`/`position` ב-State, ואינם מאפסים או שומרים את טיוטת העריכה שבאזור הפרטים.

**סטטוס:** Checkbox מפעיל `PATCH /api/tasks/:id/status`. משימה נשארת באותו מקום; סימון חזותי מתאים כולל משימות ללא כותרת. בשגיאה מוחזר המצב הקודם ומוצגת הודעה.

**מחיקה:** לחיצה על `מחק משימה` בפרטים בלבד ⇒ Confirmation ⇒ `DELETE`. רק בהצלחה מסירים מהרשימה ומאפסים את בחירת המשימה. בשגיאה הפרטים נשארים והמשתמש מקבל הודעה; אם המשתמש ביטל אישור לא נשלחת בקשה.

**גרירה:** משתמש גורר באמצעות Handle ייעודי (Touch במובייל, Pointer/Mouse במחשב); בסיום גרירה נשלח `PUT /api/tasks/order`; אם הכתיבה נכשלה, יש לשחזר את הסדר השמור האחרון ולתת אפשרות לרענן את הרשימה.

### 2.6 עקביות בכתיבת סדר ובמקביליות

- `position` הוא הסדר הקנוני במסד הנתונים. **יצירה, מחיקה ושינוי סדר** רצים ב-Transactions כדי למנוע מיקומים חסרים או כפולים קבועים.
- כל פעולות שינוי מבנה הרשימה משתמשות ב-**אותו PostgreSQL transaction-level advisory lock**, בתוך Transaction יחיד ובאותו DB Client. השרת מעדכן מיקומים מחדש ל-0..N-1 תחת הנעילה, ומבצע Commit אטומי. נעילה זו אינה תשתית נוספת ואינה מזהה משתמש.
- בקשת `PUT /api/tasks/order` חייבת לכלול את **כל מזהי המשימות כפי שהלקוח מכיר אותם**. תחת הנעילה, השרת קורא את קבוצת המזהים הקיימת ומאמת שקיימת התאמה מלאה אחד-לאחד, ללא כפילויות. אם נוספה/נמחקה משימה בין הטעינה לגרירה, מחזירים `409` והלקוח מציע Refresh; אין להשמיט בשקט משימות חדשות או להחזיר משימות שנמחקו.
- אם שני מבקרים מסדרים את אותה קבוצת משימות בו-זמנית, **הסדר שנכתב אחרון קובע**, ללא UI לפתרון התנגשויות. בדיקת קבוצת מזהים ב-`409` היא הגנה מפני אובדן/השחתת מבנה הרשימה, **לא** זיהוי התנגשויות עריכה עסקי.
- ב-`DELETE` של משימה שאינה קיימת וב-`PATCH` למשימה שנמחקה בידי מבקר אחר, מחזירים `404`; UI מציג שגיאה ורענון יכול לתקן את המצב.

### 2.7 אבטחה ופרטיות

- **אין Authentication ואין Authorization ברמת משתמש**; לכל מבקר אותן יכולות, במפורש לפי ה-PRD. אין להציג את השירות כאישי או פרטי.
- Database credentials נשמרים **רק ב-Vercel Environment Variables**, ובמחשב הפיתוח בקובץ `.env` שאינו ב-Git. אין לכלול סיסמאות, Connection String, Service Role Key או Tokens ב-Bundle של React, ב-Git או במשתני `VITE_*`.
- אין חיבור של Frontend ישירות ל-Supabase Database/Data API. ב-Database יש להשתמש ב-DB Role ייעודי בעל הרשאות CRUD לטבלת `tasks` בלבד, אם ניתן; לא להשתמש בהרשאת Superuser להרצת האפליקציה. לבטל גישת Data API ציבורית לא מורשית לטבלה (למשל RLS ללא Policies ציבוריים אם הטבלה חשופה ל-Data API). Backend SQL Role מתאים יכול לפעול על הטבלה ללא חשיפה לציבור.
- בקשות Browser ל-API נעשות באותו Origin. הגבלות CORS אינן תחליף ל-Authentication. חשוב להבין שכל אדם או תוכנה יכולים לפנות ל-API הציבורי; אין לסמוך על כפתורי הממשק לאבטחה.
- HTTPS/TLS חובה. אין לשמור מידע אישי ייעודי או פרטי משתמש; כותרת ותיאור הם טקסט חופשי שכל המבקרים יכולים לראות. אין לבצע Logging של תוכן המשימות שלא לצורך.
- Validation בשרת, Parameterized Queries, שגיאות שאינן חושפות SQL/Secrets, Timeouts, הגבלת גודל בקשות והגנות תשתית מפני Abuse ככל שהמסלול מאפשר. הגבלת עומס **אינה** פתרון מלא לספאם או למחיקה זדונית ללא Authentication.

### 2.8 PWA ו-Offline

- האפליקציה רצה דרך HTTPS ומספקת `manifest.webmanifest` עם `name`, `short_name`, `start_url: /`, `scope: /`, `display: standalone`, צבעים ואייקונים בגדלים 192×192 ו-512×512; `lang: he`, `dir: rtl` ככל שהשדות נתמכים.
- אפשרות ההתקנה ב-Chrome על Android היא יכולת של הדפדפן; **אין להבטיח שהצעת ההתקנה תוצג בכל מכשיר**. אין דרישה לכפתור התקנה מיוחד.
- לא משתמשים ב-Caching של API Results, Background Sync או אחסון משימות ב-IndexedDB/Local Storage. אם נרשם Service Worker לצורכי PWA/Assets, יש לבטל Interception של `/api/*` ולמנוע הצגת רשימת משימות שמורה במצב Offline. כאשר אין חיבור, מציגים שגיאת רשת ומונעים פעולות נתונים.
- הנתונים נשארים ב-PostgreSQL גם לאחר סגירת או הסרת התקנת ה-PWA; ה-PWA אינה יחידת אחסון נתונים נפרדת.

### 2.9 GitHub, Hosting, Deployment ו-Configuration

**Repository יחיד:** פרויקט React/Vite, תיקיית Vercel `api` ל-Handlers ב-TypeScript, לוגיקה משותפת בטוחה לשרת ו-`supabase/migrations` לקובצי SQL. אין צורך ב-Monorepo של Services נפרדים. מקור האמת ל-Schema הוא Migrations ב-GitHub.

**Frontend + API ב-Vercel:** מחברים GitHub Repository לפרויקט Vercel אחד. בכל Push לענף הראשי Vercel מבצע Build ו-Production Deployment. העבודה נדחפת ישירות לענף הראשי, ללא Pull Requests, ולכן Preview Deployments אינם חלק מתהליך העבודה; משתני הסביבה של Preview אינם מוגדרים, כך ש-Preview שייווצר לא יתחבר לשום מסד נתונים. Build של Vite מפיק `dist`; `/api/*` מטופל ב-Vercel Functions ולא ב-React Router. יש להגדיר SPA fallback עבור `/about` בלי לדרוס נתיבי API, קבצים סטטיים או Manifest. כל השירות מתפרסם תחת Domain יחיד, עם HTTPS מובנה.

**Database ב-Supabase:** פרויקט PostgreSQL מנוהל. Backend Functions מתחברות באמצעות **Supabase Shared Transaction Pooler**, פורט 6543, עם SSL. ב-`pg.Pool` משתמשים ב-`max: 1` לכל Function Instance (ותקרות Connection/Idle/Query Timeout מתאימות), ושומרים Pool ברמת מודול לשימוש חוזר. תחת Pooler כל Transaction חייבת להשתמש באותו `client` משלב BEGIN ועד COMMIT/ROLLBACK; לא מריצים Transactions דרך קריאות מנותקות ל-`pool.query` [3][5]. יש להשתמש ב-Parameterized Queries ולא ב-Named Prepared Statements המבוססים על מצב Session. רצוי להציב את Functions באזור קרוב ככל האפשר לאזור Supabase כדי להפחית Latency.

**Migrations:** קובצי SQL ממוספרים/מתוארכים תחת `supabase/migrations`, עם Review ב-Git. הסדר קבוע: **קודם Dev, ורק אחר כך Production** (ראו ADR-1).
- **Dev:** ה-Migration מוחלת על פרויקט ה-Dev במהלך הבנייה, באמצעות Supabase CLI (`supabase db push`). ה-CLI במחשב הפיתוח מקושר **לפרויקט ה-Dev בלבד** ולעולם אינו מקושר ל-Production.
- **Production:** פרויקט ה-Production מחובר ל-Repository באמצעות **Supabase GitHub Integration**, עם האפשרות *Deploy to production* פעילה. Push לענף הראשי מחיל אוטומטית את ה-Migrations החדשות על Production, במקביל ל-Deployment של Vercel; אין הרצה ידנית מול Production. פרויקט ה-Dev **אינו** מחובר ל-GitHub. Automatic Branching של Supabase אינו בשימוש.
- **אישור לפני Push:** מאחר שה-Push עצמו מחיל את ה-Migrations על Production, לפני כל Push שכולל Migration חדשה Claude עוצר, מסביר למשתמש בשפה פשוטה מה ישתנה במסד הנתונים של האתר החי, ודוחף רק לאחר אישור מפורש.
- מאחר שהחלת ה-Migration וה-Deployment של הקוד רצים במקביל ואין ביניהם סדר מובטח, כל Migration חייבת להיות **תואמת-לאחור** לקוד שכבר רץ ב-Production, ולא הרסנית; Migration שעלולה למחוק נתונים מחייבת אישור מפורש של המשתמש לפני ה-Push.
- אין להריץ Migrations בכל בקשת API או בכל Cold Start. אין לערוך Schema ידנית ללא Migration מתועדת [4][12].

**סביבות:** שני פרויקטי Supabase נפרדים בענן: **Dev** ו-**Production**. פרויקט ה-Dev משמש את הפיתוח המקומי ואת הבדיקות האוטומטיות; פרויקט ה-Production משמש את האתר החי בלבד. Preview Deployments, פיתוח ובדיקות לעולם אינם מחוברים ל-Production Database. הנתונים בפרויקט ה-Dev הם נתוני בדיקה שמותר למחוק; בדיקות ה-Integration רשאיות לנקות את טבלת `tasks` שם, ורצות רק כאשר הוגדר להן במפורש Connection String של Dev. אין שימוש ב-Docker או במסד מקומי. התוכנית החינמית של Supabase מוגבלת לשני פרויקטים פעילים, כך ששני הפרויקטים מנצלים את המכסה במלואה; גם פרויקט ה-Dev עלול להיעצר לאחר חוסר פעילות ויש להפעילו מחדש בעת הצורך. אין לפרסם Database Credentials בתוצרי Build.

**הרצה מקומית:** שרת הפיתוח של Vite לבדו אינו מריץ את `/api/*`. ההרצה המקומית נעשית באמצעות `vercel dev` (Vercel CLI), שמריץ את ה-Frontend ואת ה-Functions יחד באותה כתובת מקומית, מול פרויקט ה-Dev. משתני הסביבה המקומיים נשמרים בקובץ `.env` שאינו ב-Git, עם `.env.example` המתעד את שמותיהם בלבד.

**ניהול גרסאות:** לקבע גרסאות Major של Dependencies ו-Node LTS שנתמך ב-Vercel בעת יצירת הפרויקט, להשתמש ב-Lockfile ולהריץ את הבדיקות מקומית לפני כל Push. אין CI נפרד ב-GitHub. לא לקבע במסמך גרסאות Patch חולפות.

### 2.10 אימות איכות ארכיטקטוני

- **Unit:** `trim` ו-Validation, גבולות 100/2000, תאריך בעבר, תיאור ללא כותרת, שינוי סטטוס, סדר ותשובות API.
- **Integration מול פרויקט ה-Dev ב-Supabase (לעולם לא מול Production):** CRUD, Atomic Reorder, מיקומים רציפים, שתי גרירות במקביל, יצירה/מחיקה במקביל לגרירה, `404` ו-`409`.
- **End-to-end ב-Chrome:** יצירה ב-Modal, כשל שמירה ושמירת נתונים בטופס, שינוי שדות ושמירה ידנית, ביטול שינויים במעבר, מחיקה באישור, Checkbox, Drag & Drop במחשב וב-Touch על Android, ניווט ורענון שנטען מהשרת.
- **בדיקות PWA:** תקינות Manifest/HTTPS ואפשרות התקנה ב-Chrome Android, ומצב רשת מנותקת ללא Offline Task Data.
- כל בדיקה מכוונת לאימות הדרישות שכבר הוגדרו ב-PRD; אין כאן הצעה לפיצ'רים נוספים.

## 3. מקורות מרכזיים

המקורות נבדקו במסגרת בחירת ה-Stack בתאריך 12.10.2026. יש לוודא מכסות ותעריפים לפני פתיחת חשבונות ופריסה:

1. [Vercel – Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) – Vite, Functions, Deployment, SPA rewrites.
2. [Vercel – Functions Limits](https://vercel.com/docs/functions/limitations) – סביבת Node.js ומגבלות הרצה.
3. [Supabase – Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres) – Transaction Pooler וקונפיגורציית Serverless.
4. [Supabase – Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) – ניהול Schema עם CLI.
5. [node-postgres – Transactions](https://node-postgres.com/features/transactions) – Transaction על אותו DB Client.
6. [dnd-kit – Sortable and Sensors](https://dndkit.com/legacy/presets/sortable/overview/) – גרירה ומגע.
7. [Vercel – Pricing](https://vercel.com/pricing) – מחירים ותוכניות.
8. [Vercel – Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) – הגבלת Hobby לשימוש לא-מסחרי.
9. [Supabase – Billing](https://supabase.com/docs/guides/platform/billing-on-supabase) – תוכניות ומכסות.
10. [Supabase – Free Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) – עצירת פרויקט חינמי לא פעיל.
11. [MDN – Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) – Manifest, HTTPS, התקנה ויחסה ל-Offline.
12. [Supabase – GitHub Integration](https://supabase.com/docs/guides/deployment/branching/github-integration) – החלת Migrations אוטומטית על Production בעת Push; זמין בכל תוכנית.

## החלטות מרכזיות (ADRs)

ההחלטות שלהלן התקבלו מראש, לפני תחילת הבנייה, ומחייבות את המימוש. הן מתארות את מה שייבנה ואינן מתארות קוד קיים. שמות קבצים ונתיבים המופיעים בהן הם המיקום המתוכנן. החלטות חדשות שיתקבלו במהלך הבנייה יתועדו כ-ADR-12 ואילך; החלטה שיתברר שאינה ישימה תעודכן באישור המשתמש.

### ADR-1: החלת Migrations אוטומטית על Production דרך Supabase GitHub Integration

**הקשר:** חלופה אפשרית היא הרצה ידנית של `supabase db push` פעמיים – על Dev ואז על Production – תוך החלפת הקישור של ה-CLI בין הפרויקטים. המשתמש אינו מתכנת, והנוהל אמור לשמש גם תלמידים לא-טכניים; החלפת קישור ידנית חושפת לטעות של הרצת פעולות על Production במקום על Dev. הנוהל הרצוי: בנייה ← בדיקה מקומית מול Dev ← "שמור שינויים ב-GitHub" ← הכול עולה ל-Production, ללא פקודות נוספות.

**החלטה:** ה-Migrations יוחלו על Dev במהלך הבנייה באמצעות Supabase CLI המקושר ל-Dev בלבד. פרויקט ה-Production יחובר ל-Repository ב-Supabase GitHub Integration עם *Deploy to production*, כך ש-Push לענף הראשי יחיל את ה-Migrations על Production אוטומטית. לפי תיעוד Supabase היכולת זמינה בכל תוכנית, כולל החינמית [12]. אם יתברר בעת ההגדרה שאינה זמינה, החלופה היא GitHub Actions שמריץ `supabase db push` בעת Push לענף הראשי – אותו נוהל מבחינת המשתמש.

**השלכות:**
- אין שלב אישור נפרד בין ה-Push לבין שינוי ה-Schema ב-Production; הבדיקה מול Dev היא הבדיקה היחידה.
- Migrations חייבות להיות תואמות-לאחור ולא הרסניות, כי אין סדר מובטח בינן לבין ה-Deployment של Vercel.
- כישלון Migration ב-Production עלול להשאיר את האתר החי בשגיאה עד לתיקון; אין Rollback אוטומטי, ובתוכנית החינמית של Supabase אין גיבויים אוטומטיים.
- נדרשת הגדרה חד-פעמית שהמשתמש מבצע בהדרכה: התחברות ל-CLI וקישורו ל-Dev, וחיבור פרויקט ה-Production ל-GitHub (גישה ל-Repository הזה בלבד).

### ADR-2: משתמש מסד ייעודי לאפליקציה (`app_backend`) עם RLS

**הקשר:** סעיף 2.7 קובע שהאפליקציה לא תרוץ בהרשאות מנהל, ושיש לחסום גישה ציבורית לטבלה דרך ה-Data API. המשתמש רוצה ללמד תלמידים את הנוהל הנכון גם לפרויקטים עם מידע רגיש וטבלאות רבות.

**החלטה:** בכל פרויקט Supabase ייווצר ידנית, פעם אחת, משתמש `app_backend` עם סיסמה משלו (`create user app_backend with password '...'`), כך שהסיסמה אינה נכתבת בקוד. את היצירה מבצע המשתמש בהדרכה. ה-Migrations יעניקו לו הרשאות מפורשות לכל טבלה שהאפליקציה צריכה (`grant select, insert, update, delete`), יפעילו RLS עם Policy ייעודי ל-`app_backend` וישללו גישה מ-`anon`/`authenticated`. ה-Backend יתחבר דרך ה-Transaction Pooler בשם `app_backend.<project-ref>`. ה-Data API יכובה בעת יצירת הפרויקטים.

**השלכות:** כל טבלה חדשה בעתיד חייבת לכלול באותה Migration את ה-`grant` וה-Policy ל-`app_backend`, אחרת ה-Backend לא יוכל לגשת אליה. דליפה של פרטי החיבור מוגבלת לטבלאות שהוענקו. שם המשתמש זהה בכל הסביבות; הסיסמאות שונות.

### ADR-3: הצפנת החיבור למסד ללא אימות שרשרת התעודות

**הקשר:** החיבור מ-Vercel Functions ל-Supabase Pooler חייב להיות מוצפן. תעודת ה-Pooler של Supabase אינה חתומה על ידי רשות תעודות המוכרת ל-Node.js כברירת מחדל; אימות מלא מחייב לצרף לפרויקט את תעודת ה-CA של Supabase.

**החלטה:** ב-`pg.Pool` יוגדר `ssl: { rejectUnauthorized: false }` – התעבורה מוצפנת, אך זהות השרת אינה מאומתת מול CA.

**השלכות:** הגנה מפני האזנה, אך לא מפני התחזות לשרת ברמת הרשת (סיכון נמוך בין Vercel ל-Supabase). שיפור אפשרי בעתיד: לצרף את תעודת ה-CA של Supabase (ציבורית, מותר ב-Git) ולהפעיל אימות מלא.

### ADR-4: כלי ה-CLI כתלויות פיתוח של הפרויקט, וגופנים

**הקשר:** נדרשים Supabase CLI ו-Vercel CLI; `DESIGN.md` מציג את Inter ואינו קובע גופן עברי.

**החלטה:** `supabase` ו-`vercel` יותקנו כ-devDependencies ויופעלו ב-`npx`, כך שהגרסה מקובעת ב-Lockfile ואין צורך בהתקנה גלובלית. Inter ייטען מקומית מחבילת `@fontsource-variable/inter` (ללא פנייה לשירות חיצוני) עבור טקסט לטיני ומספרים; לעברית ישמש גופן ה-Sans-serif של המערכת (Segoe UI / Roboto / Noto Sans Hebrew).

**השלכות:** `npm install` יתקין את כל הכלים. אם `npm audit` ידווח על חולשות בתלויות של כלי הפיתוח בלבד (שאינם נכללים באתר), הן יתועדו ולא יחסמו את הבנייה; חולשות בתלויות האתר עצמו יטופלו.

### ADR-5: "היום" לצורך Validation של תאריך יעד

**הקשר:** תאריך יעד חייב להיות היום או בעתיד (ביצירה, ובעדכון כשהתאריך משתנה). סעיף 2.3 הציע כהנחת יישום את `Asia/Jerusalem` לבדיקה בשרת, ואסר להסתמך על שעון מכונת ה-Serverless או על `toISOString()`.

**החלטה:** בשרת "היום" יחושב לפי `Asia/Jerusalem` (`Intl.DateTimeFormat`), בקבוע `PRODUCT_TIME_ZONE` בקובץ ה-Validation המשותף (ADR-6). בטופס, ברירת המחדל וה-`min` של שדה התאריך הם התאריך המקומי של המכשיר. באזור העריכה, הגבלת ה-`min` לא תחסום שמירה של משימה שתאריך היעד השמור שלה כבר עבר ולא שונה (למשל באמצעות ביטול ה-Validation המובנה של הדפדפן לטופס, כשהבדיקה נעשית בקוד).

**השלכות:** למשתמשים בישראל הלקוח והשרת יסכימו תמיד. משתמש באזור זמן אחר, בשעות שבהן התאריך אצלו מוקדם מזה שבישראל, עלול לקבל מהשרת "תאריך היעד לא יכול להיות בעבר" על ברירת המחדל; ההודעה תוצג בטופס, והוא יוכל לבחור תאריך אחר או לנקות. שינוי אזור הזמן הוא שינוי של קבוע אחד.

### ADR-6: כללי Validation משותפים ללקוח ולשרת

**הקשר:** אותם כללים (כותרת או תיאור, 100/2,000 תווים, תאריך) נאכפים בטופס ובשרת, עם אותן הודעות בעברית. שכפול שלהם בשני מקומות עלול ליצור סתירות.

**החלטה:** קובץ אחד, `shared/validation.ts`, יכיל את הכללים וההודעות וייטען גם ב-React וגם ב-Vercel Functions. אורך יימדד בתווים (Code Points), כמו `varchar` ב-PostgreSQL, ולא ביחידות UTF-16 של JavaScript. השרת הוא הבדיקה המחייבת.

**השלכות:** שינוי כלל נעשה במקום אחד. הקוד ב-`shared/` חייב להישאר בטוח לדפדפן (ללא סודות או גישה ל-Database).

### ADR-7: בדיקות Integration מול Dev ששומרות על נתוני הבדיקה

**הקשר:** בדיקת תקרת 1,000 המשימות ובקשות מקבילות דורשת Database אמיתי. ARCHITECTURE 2.9 מתיר לבדיקות לנקות את `tasks` ב-Dev, אך המשתמש בודק ידנית עם נתוני בדיקה שם.

**החלטה:** בדיקות Integration (`*.integration.test.ts`) ירוצו רק דרך `npm run test:integration`, נפרד מ-`npm test`, ויטענו את `DATABASE_URL` מ-`.env` (Dev בלבד). בתחילת ההרצה יישמר עותק של כל המשימות, ובסיומה הן יוחזרו בדיוק כפי שהיו. שני מבקרים יודמו באמצעות שני Pools נפרדים.

**השלכות:** הרצה דורשת חיבור ל-Dev ולוקחת זמן; בזמן ההרצה הרשימה ב-Dev משתנה זמנית. אם ההרצה נקטעת באמצע בכוח, ייתכן שיהיה צורך להזין מחדש את נתוני הבדיקה ב-Dev.

### ADR-8: עדכון פרטים בנעילת שורה, ומחיקה עם נרמול מיקומים

**הקשר:** ב-`PATCH` כלל "תאריך בעבר" חל רק כשהתאריך שונה מהערך השמור, ולכן השרת צריך להשוות לערך שבאמת יידרס. בנוסף, בקשת עריכה אסור שתדרוס `completed` או `position`, ומחיקה משנה את מבנה הרשימה (ARCHITECTURE 2.6).

**החלטה:** `PATCH /api/tasks/:id` יחייב את שלושת השדות `title`, `description`, `dueDate` בגוף הבקשה (אחרת `400`) ויתעלם מכל שדה אחר. השרת יקרא את `due_date` השמור ב-`select ... for update` ויעדכן באותה Transaction, כך שההשוואה והעדכון אטומיים; שמירות מקבילות מסודרות לפי נעילת השורה, והאחרונה קובעת (`last write wins`). ה-`UPDATE` ייגע רק בשלושת השדות וב-`updated_at`. פונקציית ה-Validation המשותפת תקבל את תאריך היעד השמור כדי שהלקוח והשרת יפעילו אותו כלל. `DELETE /api/tasks/:id` ירוץ תחת ה-Advisory Lock המשותף וינרמל את `position` ל-0..N-1 באותה Transaction.

**השלכות:** עדכון פרטים אינו נועל את כל הרשימה ואינו מתנגש עם יצירה/מחיקה/גרירה. מזהה שאינו UUID יחזיר `400`; משימה שלא קיימת תחזיר `404` (גם במחיקה כפולה). בקשת `PATCH` חלקית תידחה במקום למחוק שדה בשקט.

### ADR-9: שמירת סטטוס וסדר – חוזה, נעילה וממשק אופטימי

**הקשר:** Checkbox וגרירה נשמרים מיד (PRD זרימות 4–5), ומותר UI אופטימי בתנאי Rollback (2.2). שינוי סדר הוא שינוי מבנה הרשימה ועלול להתנגש ביצירה/מחיקה/גרירה במקביל (2.6). ב-Vercel, נתיב `api/tasks/[id].ts` אינו יכול לשבת לצד תיקייה `api/tasks/[id]/` עבור `/status`.

**החלטה:**
- ה-Handler של משימה בודדת ימוקם ב-`api/tasks/[id]/index.ts`; לצדו `[id]/status.ts`, ו-`api/tasks/order.ts` (נתיב סטטי, גובר על `[id]`).
- `PATCH /api/tasks/:id/status` ישמור ערך מפורש (`{completed}`, לא Toggle) בשאילתת `UPDATE` אחת, **בלי** ה-Advisory Lock: אינו נוגע ב-`position` או בשדות הפרטים, ולכן אינו מתנגש בשינויי מבנה.
- `PUT /api/tasks/order` ירוץ תחת אותו Advisory Lock של יצירה/מחיקה, ישווה את קבוצת המזהים שנשלחה לקבוצה במסד (אחד-לאחד, ללא כפילויות), ובאי-התאמה יחזיר `409 ORDER_CONFLICT` בלי לשנות דבר. העדכון יהיה שאילתה אחת עם `unnest($1::uuid[]) with ordinality`, והתשובה היא הרשימה בסדרה החדש. מגבלת ה-Body בנתיב זה 64KB (1,000 UUID ≈ 39KB), ובשאר הנתיבים 16KB.
- בלקוח, הסימון והגרירה יוצגו מיד. בכישלון יוחזר **רק** השדה שהשתנה: `completed` של אותה משימה, או סדר הרשימה הקודם, כך ששינויים אחרים שקרו בינתיים נשמרים. ב-`409` יוצג כפתור "רענן את הרשימה" שטוען את הרשימה מחדש מהשרת. Checkbox יושבת עד שבקשת הסטטוס שלו מסתיימת, וגרירה נוספת תושבת עד שהשמירה הקודמת מסתיימת, כדי שתשובות לא יגיעו בסדר הפוך.
- הגרירה תופעל רק מידית ייעודית (`touch-action: none`) באמצעות `PointerSensor` (עכבר ומגע) ו-`KeyboardSensor` (נגישות), עם הודעות קורא מסך בעברית.

**השלכות:** סטטוס וסדר מקבילים אינם דורסים זה את זה. גרירה מתוך רשימה שאינה עדכנית נדחית במפורש ואינה משמיטה משימות. לאחר שמירת פרטים, הלקוח יעדכן מתשובת השרת רק את שדות הפרטים, כדי לא לדרוס סימון השלמה שעדיין נשמר.

### ADR-10: PWA ללא Service Worker

**הקשר:** סעיף 2.8 מגדיר Service Worker כאופציונלי, ואוסר הצגת רשימת משימות שמורה או שינויים במצב Offline. Chrome ב-Android מאפשר התקנה עם Manifest תקין ו-HTTPS.

**החלטה:** האתר יספק `public/manifest.webmanifest` (שם, `display: standalone`, `lang: he`, `dir: rtl`, אייקונים 192/512 ואייקון `maskable`) ו-`theme-color`, **ללא** Service Worker. האייקונים ייווצרו מקובצי SVG ב-`public/icons/` באמצעות סקריפט שמשתמש ב-Chromium של Playwright (ADR-11). כשאין חיבור תוצג הודעה קבועה בשני הדפים; פעולות ייכשלו בבקשת הרשת ויחזירו את המצב הקודם, כמו בכל כשל שרת.

**השלכות:** אין שום מנגנון שיכול לשמור משימות או תשובות API במכשיר. פתיחה בלי חיבור תציג את דף "אין אינטרנט" של Chrome. אם יתברר במכשיר כלשהו שההתקנה דורשת Service Worker, החלופה היא Service Worker מינימלי שמעביר כל בקשה לרשת ללא Cache.

### ADR-11: בדיקות E2E ב-Playwright מול Dev, והכלים בתוך הפרויקט

**הקשר:** סעיף 2.10 דורש בדיקות End-to-End ב-Chrome. המשתמש דורש שכל ההתקנות יהיו בתוך תיקיית הפרויקט בלבד (המשך ל-ADR-4).

**החלטה:** `@playwright/test` יותקן כ-devDependency; דפדפן Chromium יותקן לתוך `node_modules` (`PLAYWRIGHT_BROWSERS_PATH=0`) על ידי סקריפט שרץ אוטומטית כ-`postinstall` של `npm install`. `npm run test:e2e` יריץ את בדיקות ה-E2E מול `vercel dev` ופרויקט ה-Dev, בשני מצבים: Desktop Chrome ו-Mobile Chrome. לפני ההרצה יישמר עותק של טבלת `tasks` ב-Dev ובסיומה הוא יוחזר, באמצעות קוד משותף עם בדיקות ה-Integration (ADR-7). שגיאות שרת ומצב לא-מקוון ידומו בדפדפן (`page.route`, `setOffline`). מול Production יבוצעו רק בדיקות קריאה.

**השלכות:** הרצה ראשונה של `npm install` צפויה להוריד כ-150MB. גרירה במגע אמיתי והתקנת PWA בטלפון ייבדקו ידנית. בזמן הרצת E2E הרשימה ב-Dev משתנה זמנית.

### ADR-12: הרצה מקומית ב-`npm start`, ו-SPA Fallback שאינו תופס קובצי פיתוח

**הקשר:** Vercel CLI מסרב להריץ `vercel dev` כאשר הסקריפט `dev` ב-`package.json` מפעיל אותו בעצמו (`DEV_RECURSIVE_INVOCATION`). בנוסף, תחת `vercel dev` כלל ה-Rewrite הכללי (`/((?!api/).*)` ← `/index.html`) תפס גם את קובצי הפיתוח של Vite (`/src/main.tsx`, `/@vite/client`) והאתר נטען כדף ריק.

**החלטה:** `npm start` מריץ `vercel dev` (האתר המלא: Frontend + API מול Dev); `npm run dev` מריץ Vite בלבד (מסכים ללא API). ה-Rewrite ב-`vercel.json` הוא `/((?!api/|@)[^.]*)` ← `/index.html`: רק נתיבי דפים, ללא נתיבי API, ללא נתיבים פנימיים של Vite וללא קבצים (נתיב שיש בו נקודה).

**השלכות:** `/about` ונתיבים לא מוכרים נטענים ב-Refresh; קבצים סטטיים ו-`/api/*` אינם מושפעים. נתיב דף שיכיל נקודה לא יקבל Fallback – אין כאלה באתר.

### ADR-13: אזור Frankfurt ל-Database ול-Functions

**הקשר:** ARCHITECTURE 2.9 ממליץ להציב את ה-Functions קרוב ל-Supabase. ברירת המחדל של פרויקט Vercel היא `iad1` (ארה"ב).

**החלטה:** שני פרויקטי Supabase נוצרו ב-`eu-central-1` (Frankfurt), ו-`vercel.json` קובע `"regions": ["fra1"]` ל-Functions.

**השלכות:** Latency נמוך בין ה-Functions למסד. שינוי אזור ב-Supabase מחייב עדכון `regions` בהתאם.

### ADR-14: תאריכים כמחרוזות, וכתובת חיבור ללא `sslmode`

**הקשר:** `pg` ממיר עמודות `date` לאובייקט `Date` לפי אזור הזמן של השרת, ועלול להזיז יום – בניגוד ל-ARCHITECTURE 2.3. בנוסף, `sslmode` בכתובת החיבור דורס בגרסאות `pg` עדכניות את `ssl: { rejectUnauthorized: false }` (ADR-3) ומפעיל אימות תעודה שנכשל מול ה-Pooler.

**החלטה:** `server/db.ts` מגדיר Type Parser ל-`date` (OID 1082) שמחזיר את המחרוזת `YYYY-MM-DD` כפי שהיא, ומסיר `sslmode` מהכתובת לפני יצירת ה-Pool.

**השלכות:** `dueDate` עובר בין המסד, ה-API והטופס כמחרוזת תאריך בלבד, ללא שעון. כתובת שהועתקה עם `sslmode` עדיין תעבוד.

### ADR-15: Migration שהוחלה אינה נערכת; תיקון נעשה ב-Migration חדשה

**הקשר:** בדיקות ה-Integration גילו שאילוץ "כותרת או תיאור" (`title ~ '\S' or description ~ '\S'`) מאפשר שורה ששני השדות בה `NULL`, כי תוצאת `NULL` של אילוץ נחשבת עוברת. ה-Migration המקורית כבר הוחלה על Dev, ו-Supabase מסמנת Migrations שהוחלו ולא מריצה אותן שוב.

**החלטה:** התיקון נוסף כ-Migration נפרדת (`20261025190000_fix_tasks_content_check.sql`) שמחליפה את האילוץ ב-`coalesce(title ~ '\S', false) or coalesce(description ~ '\S', false)`. כלל קבוע: Migration שהוחלה על סביבה כלשהי אינה נערכת; כל שינוי הוא Migration חדשה.

**השלכות:** ההיסטוריה זהה ב-Dev וב-Production, ו-Production יקבל את שתי ה-Migrations לפי הסדר בעת ה-Push. בדיקת Integration מכסה את המקרה.
