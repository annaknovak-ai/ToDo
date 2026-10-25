# תוכנית – Milestone 3: עריכת פרטים ומחיקת משימה

**מקורות:** `MILESTONES.md` (Milestone 3), `PRD.md` (זרימות 3 ו-6, FR-02, FR-05, FR-08, FR-10, טבלת מקרי קצה, נוסחי הודעות), `DESIGN.md` (1.2, 1.4, 2.3), `ARCHITECTURE.md` (2.3–2.6, ADR-5, ADR-6, ADR-7, ADR-8, ADR-9, ADR-11, ADR-16, ADR-17).
**מצב הקוד בפתיחה:** Milestone 2 ✅ – `GET`/`POST /api/tasks`, רשימה, אזור פרטים לקריאה בלבד, Modal יצירה (`Modal.tsx` על `<dialog>`), Validation משותף, בדיקות Unit/Component/Integration/E2E.

## 1. מטרה והיקף

אזור הפרטים הופך לטופס עריכה: שדות **כותרת**, **תיאור** ו-**תאריך יעד** ניתנים לעריכה מיד, עם **"שמור שינויים"** (שומר ב-`PATCH`) ו-**"מחק משימה"** (פותח Modal אישור ומוחק ב-`DELETE`). טיוטת העריכה נשמרת בזיכרון React בלבד ומתבטלת במעבר משימה, מעבר דף או Refresh.

**מחוץ להיקף (Milestones הבאים):** Checkbox פעיל ו-`PATCH /status`, גרירה ו-`PUT /order` (M4); ליטוש חזותי מלא ו-PWA (M5). ה-Checkbox ברשימה נשאר לקריאה בלבד.

**אין שינוי במבנה מסד הנתונים** – אין Migration חדשה (הטבלה, ההרשאות ל-`app_backend` ו-`delete` כבר קיימים). `updated_at` מתעדכן ב-`UPDATE` עצמו (`updated_at = now()`), בלי Trigger. לכן הדחיפה בסוף ה-Milestone לא תשנה את מבנה ה-Production Database.

## 2. קבצים

| קובץ | פעולה | תוכן |
|---|---|---|
| `shared/validation.ts` | שינוי | אפשרות `savedDueDate` ל-`validateTaskInput`: בדיקת "בעבר" רק כשהתאריך שונה מהשמור |
| `shared/validation.test.ts` | שינוי | בדיקות לכלל העדכון |
| `server/tasksRepository.ts` | שינוי | `updateTaskDetails()` (נעילת שורה), `deleteTask()` (Advisory Lock + נרמול), `TaskNotFoundError`, `TaskValidationError` |
| `server/taskHandler.ts` | חדש | Handler ל-`/api/tasks/:id`: `PATCH` ו-`DELETE` |
| `server/taskHandler.test.ts` | חדש | בדיקות ה-Handler עם Repository מדומה |
| `server/tasksHandler.ts` | שינוי קטן | הוצאת `FIELD_ORDER` ובחירת השגיאה הראשונה לעזר משותף (לשימוש גם ב-`taskHandler.ts`) |
| `api/tasks/[id]/index.ts` | חדש | חיבור ל-`createTaskHandler` (מיקום לפי ADR-9) |
| `src/api/tasksApi.ts` | שינוי | `updateTask(id, input)`, `deleteTask(id)` |
| `src/lib/apiErrors.ts` | חדש | המרת שגיאת API/רשת להודעה (מוצא מ-`CreateTaskModal` ומשותף לעריכה ולמחיקה) |
| `src/components/TaskDetails.tsx` | שינוי מהותי | טופס עריכה, שמירה, הודעת הצלחה, פתיחת אישור מחיקה |
| `src/components/TaskDetails.test.tsx` | חדש | בדיקות רכיב לעריכה ולמחיקה |
| `src/components/DeleteTaskModal.tsx` | חדש | Modal אישור מחיקה |
| `src/components/Modal.tsx` | שינוי | אפשרויות `closeOnOverlayClick` ו-`showCloseIcon` (ברירת מחדל: כמו היום) |
| `src/components/CreateTaskModal.tsx` | שינוי קטן | שימוש ב-`src/lib/apiErrors.ts` במקום הפונקציה הפנימית |
| `src/pages/HomePage.tsx` | שינוי | `key` לפי המשימה הנבחרת, עדכון שדות הפרטים אחרי שמירה, הסרה ואיפוס בחירה אחרי מחיקה |
| `src/messages.ts` | שינוי | נוסחים חדשים מ-PRD 4.ג |
| `src/styles.css` | שינוי | כפתור מחיקה אדום, הודעת הצלחה ירוקה, שורת כפתורים באזור הפרטים, Modal אישור קטן |
| `src/App.test.tsx` | שינוי | עדכון הבדיקה "אין פעולות עריכה/מחיקה" + זרימת עריכה ומחיקה ברמת הדף |
| `tests/api/tasks.integration.test.ts` | שינוי | עדכון, Last Write Wins, מחיקה ונרמול – מול Dev |
| `tests/e2e/edit.spec.ts` | חדש | זרימות עריכה ב-Chrome (Desktop + Mobile) |
| `tests/e2e/delete.spec.ts` | חדש | זרימות מחיקה ב-Chrome (Desktop + Mobile) |

## 3. Validation משותף – `shared/validation.ts`

- `validateTaskInput(input, { today, savedDueDate? })`:
  - בלי `savedDueDate` (יצירה) – כמו היום.
  - עם `savedDueDate` (עדכון, יכול להיות `null`): אם `dueDate` אחרי נרמול **שווה** ל-`savedDueDate` – לא בודקים "בעבר" (אבל עדיין בודקים פורמט תקין). אם שונה – בודקים "בעבר" כרגיל.
- אותה פונקציה בלקוח (עם `today = localToday()` ו-`savedDueDate = task.dueDate`) ובשרת (עם `today` לפי `Asia/Jerusalem` ו-`due_date` השמור במסד) – ADR-6, ADR-8.
- בדיקות חדשות: תאריך שמור בעבר שלא שונה – עובר; שינוי לתאריך אחר בעבר – נחסם; שינוי לתאריך עתידי/היום – עובר; ניקוי תאריך שמור – עובר; `savedDueDate = null` ותאריך חדש בעבר – נחסם.

## 4. שרת – `/api/tasks/:id`

### 4.1 Repository (`server/tasksRepository.ts`)

**`updateTaskDetails(id, validate)`** – `validate` היא פונקציה שמקבלת את `due_date` השמור ומחזירה `ValidationResult`:
1. `client = await db.connect()`; `begin`.
2. `select due_date from public.tasks where id = $1 for update` – אם אין שורה: `rollback`, `TaskNotFoundError`.
3. `validate(savedDueDate)`; אם לא תקין: `rollback`, `TaskValidationError` (נושא את ה-`errors`).
4. `update public.tasks set title = $2, description = $3, due_date = $4, updated_at = now() where id = $1 returning ...` – **רק** שלושת השדות ו-`updated_at`, לעולם לא `completed` או `position`.
5. `commit`, החזרת המשימה המעודכנת.
- ההשוואה והעדכון באותה Transaction ובאותו `client` (Pooler, ADR-8). שמירות מקבילות לאותה משימה מסודרות לפי נעילת השורה; האחרונה קובעת. **ללא** Advisory Lock – עדכון פרטים אינו משנה את מבנה הרשימה.

**`deleteTask(id)`:**
1. `begin`; `select pg_advisory_xact_lock($1)` עם `TASKS_LIST_LOCK_KEY` (אותה נעילה של היצירה).
2. `delete from public.tasks where id = $1 returning id` – אם לא נמחקה שורה: `rollback`, `TaskNotFoundError`.
3. נרמול: `update public.tasks t set position = r.new_pos from (select id, row_number() over (order by position, id) - 1 as new_pos from public.tasks) r where t.id = r.id and t.position <> r.new_pos`.
4. `commit`.
- עדכון ההערה ליד `TASKS_LIST_LOCK_KEY` (create + delete עכשיו; reorder ב-M4).

### 4.2 Handler (`server/taskHandler.ts`)

`createTaskHandler(getRepository, now?)` – מבנה זהה ל-`tasksHandler.ts`:
- `allowMethods(['PATCH', 'DELETE'])`, אחרת `405`.
- `id` מ-`req.query.id`; אם אינו UUID תקין (Regex) – `400 INVALID_REQUEST`.
- **PATCH:** `requireJsonBody(16KB)`; פענוח **מחמיר**: גוף אובייקט שבו שלושת המפתחות `title`, `description`, `dueDate` **קיימים** (ערך `string` או `null`), אחרת `400` (ADR-8); שדות אחרים (`completed`, `position`, ...) מתעלמים מהם. קריאה ל-`updateTaskDetails(id, saved => validateTaskInput(input, { today, savedDueDate: saved }))`. תשובות: `200` + המשימה; `TaskValidationError` → `422 VALIDATION_ERROR` עם `field` ראשון (אותו סדר שדות כמו ב-POST); `TaskNotFoundError` → `404 TASK_NOT_FOUND`.
- **DELETE:** `deleteTask(id)` → `204` ללא גוף (עם `Cache-Control: no-store`); `TaskNotFoundError` → `404 TASK_NOT_FOUND` (גם במחיקה כפולה).
- שגיאות אחרות → `sendServerError` (500/503 ללא חשיפת SQL).
- `api/tasks/[id]/index.ts`: `export default createTaskHandler(() => createTasksRepository(getPool()))`.
- לבדוק מוקדם בבנייה ש-`vercel dev` מנתב את `/api/tasks/<uuid>` לקובץ הזה ושה-`rewrite` ב-`vercel.json` אינו תופס אותו (הנתיב מתחיל ב-`api/`).

## 5. לקוח

### 5.1 `src/api/tasksApi.ts`

- `updateTask(id, input): Promise<Task>` – `PATCH /api/tasks/${id}` עם JSON של שלושת השדות; שגיאה → `ApiRequestError` (כמו `createTask`).
- `deleteTask(id): Promise<void>` – `DELETE /api/tasks/${id}`; הצלחה ב-`204`.

### 5.2 `src/lib/apiErrors.ts`

פונקציה אחת שממירה שגיאה להודעה, לשימוש היצירה, העריכה והמחיקה:
- `404 TASK_NOT_FOUND` → **"המשימה כבר לא קיימת, ייתכן שנמחקה. רענן את הרשימה."**
- `409 TASK_LIMIT_REACHED` → הודעת הרשימה התמלאה (קיים).
- `422` עם `field` → ההודעה ליד השדה; `429` → "יותר מדי פעולות...".
- אין רשת (`navigator.onLine === false`) → הודעת אין חיבור.
- כל השאר → הודעת הכישלון של הפעולה: **"השמירה נכשלה. נסה שוב."** (יצירה/עריכה) או **"המחיקה נכשלה. נסה שוב."** (מחיקה).

### 5.3 `TaskDetails` – טופס עריכה

- `HomePage` מרנדר `<TaskDetails key={selectedTask.id} ... />` – החלפת משימה מרכיבה מופע חדש, כך שהטיוטה מתבטלת ללא התראה. לחיצה חוזרת על אותה משימה אינה מאפסת. מעבר לאודות או Refresh מוחקים את המצב באופן טבעי (אין Local Storage).
- State מקומי: `title`, `description`, `dueDate` (מאותחלים מהמשימה, `null` → `''`), `errors`, `saving`, `saved` (הצגת הודעת ההצלחה), `confirmingDelete`.
- שדות כמו ב-Modal היצירה (תוויות, Placeholders, הודעת שגיאה ליד שדה, `aria-invalid`), שדה תאריך עם `min={today}` לבקר התאריך בלבד, והטופס ב-`noValidate` – כדי שתאריך שמור שכבר עבר לא ייחסם בדפדפן (ADR-5); הבדיקה נעשית בקוד.
- **"שמור שינויים"** (`submit`): Validation עם `savedDueDate = task.dueDate`; בשגיאה – הודעות ליד השדות והערכים נשארים. בהצלחת Validation: `saving = true` (שני הכפתורים Disabled), `updateTask`.
  - הצלחה: `onSaved(task)` להורה, הטיוטה מתעדכנת לערכים המנורמלים שהשרת החזיר (אחרי `trim`), מוצגת **"המשימה נשמרה בהצלחה"** בגוון `success` (`role="status"`). ההודעה נעלמת כשמשנים שדה.
  - כישלון: הודעה מ-5.2 (ליד שדה או בתחתית הטופס), הערכים נשארים, אפשר לנסות שוב.
- **"מחק משימה"** (`button type="button"`, אדום): פותח `DeleteTaskModal`. Disabled בזמן שמירה.
- המשימה מוצגת מהטיוטה, לא מה-`task` שבהורה, כך ששינויים עתידיים ב-`completed`/`position` (M4) לא יאפסו אותה.

### 5.4 `DeleteTaskModal` ו-`Modal`

- `Modal` מקבל שתי אפשרויות חדשות: `closeOnOverlayClick` (לחיצה על ה-`<dialog>` עצמו מחוץ לתוכן = סגירה, רק כש-`closeDisabled` כבוי) ו-`showCloseIcon` (ברירת מחדל `true`). ה-Modal של היצירה לא משתנה.
- `DeleteTaskModal`: כותרת **"מחיקת משימה"**, השאלה **"האם אתה בטוח שברצונך למחוק את המשימה הזו?"**, כפתורי **"ביטול"** (Secondary) ו-**"אישור"** (אדום). ללא אייקון X (DESIGN 1.4). Esc ולחיצה על ה-Overlay = ביטול. ביטול לא שולח בקשה.
- **"אישור"**: `deleting = true` – "אישור", "ביטול", Esc וה-Overlay חסומים עד התשובה (כמו ADR-16). `deleteTask(task.id)`:
  - הצלחה: `onDeleted(id)` להורה – המשימה מוסרת מהרשימה, `selectedId = null`, האזור חוזר ל-**"בחר משימה מהרשימה כדי לצפות בפרטיה"**.
  - כישלון: ה-Modal נשאר פתוח עם ההודעה בתוכו (**"המחיקה נכשלה. נסה שוב."**, או הודעת "המשימה כבר לא קיימת" ב-`404`), המשימה נשארת ברשימה ובפרטים, ואפשר לנסות שוב או לבטל.
- **החלטה לתיעוד כ-ADR:** הודעת כישלון המחיקה מוצגת בתוך חלון האישור (ולא אחרי סגירתו), כמו הודעות השגיאה ב-Modal היצירה.

### 5.5 `HomePage`

- `handleSaved(saved)`: מעדכן ברשימה **רק** את `title`, `description`, `dueDate` של אותה משימה (ADR-9) – טקסט השורה מתעדכן מיד.
- `handleDeleted(id)`: מסיר מהרשימה ומאפס `selectedId`. (המיקומים בלקוח לא משמשים לסידור – הסדר הוא סדר המערך.)
- `404` בעריכה/מחיקה לא מסיר את המשימה אוטומטית; מוצגת ההודעה, ו-Refresh מתקן (ARCHITECTURE 2.6).

### 5.6 `src/messages.ts`

תוספות (מילה במילה מ-PRD 4.ג): `saveSuccess` – "המשימה נשמרה בהצלחה"; `deleteFailed` – "המחיקה נכשלה. נסה שוב."; `taskGone` – "המשימה כבר לא קיימת, ייתכן שנמחקה. רענן את הרשימה."; `deleteQuestion` – "האם אתה בטוח שברצונך למחוק את המשימה הזו?".

### 5.7 עיצוב (`styles.css`)

- `btn-danger`: רקע `error` (`#EB5757`), טקסט לבן, Hover ו-Disabled כמו שאר הכפתורים.
- `form-success`: טקסט/רקע עדין בגוון `success` (`#27AE60`), בסגנון `form-error` הקיים.
- `details-actions`: שורת כפתורים מתחת לשדות, מרווח 16px; במובייל הכפתורים ברוחב מלא זה מתחת לזה.
- `delete-modal`: חלון צר יותר מ-Modal היצירה, שאלה ב-Body Large, כפתורים בשורה.
- הסרת הסגנון לשדות `readOnly` באזור הפרטים אם קיים.

## 6. בדיקות

### 6.1 Unit – `shared/validation.test.ts`
כמפורט בסעיף 3.

### 6.2 Handler – `server/taskHandler.test.ts` (Repository מדומה)
- PATCH תקין → `200` עם ערכים מנורמלים; `completed`/`position` בגוף מתעלמים מהם ואינם מגיעים ל-Repository.
- PATCH חסר אחד משלושת השדות → `400`; `Content-Type` שגוי → `400`; גוף מעל 16KB → `413`.
- PATCH עם תוכן ריק / ארוך מדי / תאריך בעבר ששונה → `422` עם `field`; תאריך בעבר שזהה לשמור → `200`.
- `id` שאינו UUID → `400`; משימה לא קיימת ב-PATCH וב-DELETE → `404`.
- DELETE תקין → `204`; Method אחר (GET/POST/PUT) → `405`; שגיאת DB → `500` ללא פרטים.

### 6.3 רכיבים – `TaskDetails.test.tsx` + `App.test.tsx`
- בחירה מציגה שדות ערוכים עם ערכי המשימה ואת שני הכפתורים.
- שמירה מצליחה: הודעת הצלחה, הכפתורים Disabled בזמן השליחה, טקסט השורה ברשימה מתעדכן.
- Validation (ריק, ארוך, תאריך בעבר ששונה) – הודעה ליד השדה, ללא בקשה; תאריך שמור בעבר שלא שונה – נשמר.
- כישלון שמירה (500, 404) – הודעה, הערכים נשארים.
- מעבר למשימה אחרת וחזרה – הטיוטה בוטלה; מעבר לאודות וחזרה – כנ"ל.
- מחיקה: "ביטול"/Esc/Overlay לא שולחים בקשה; "אישור" חסום בזמן השליחה; הצלחה מסירה ומחזירה להודעת הבחירה; כישלון משאיר את המשימה ומציג הודעה.
- עדכון הבדיקה הקיימת ב-`App.test.tsx` שבודקת שאין כפתורי שמור/מחק.

### 6.4 Integration מול Dev – `tests/api/tasks.integration.test.ts`
(עם שמירה ושחזור של נתוני Dev, ADR-7)
- `updateTaskDetails` משנה רק את שלושת השדות; `completed` ו-`position` נשארים; `updated_at` מתקדם.
- משימה עם `due_date` בעבר (הוזנה ישירות במסד): עדכון כותרת בלי לשנות תאריך עובר; שינוי לתאריך אחר בעבר נדחה ושום דבר לא משתנה.
- משימה לא קיימת → `TaskNotFoundError`.
- **שמירות מקבילות** משני Pools לאותה משימה: שתיהן מצליחות, הערך הסופי במסד שווה לזה של השמירה שהסתיימה אחרונה, ו-`completed`/`position` לא השתנו.
- `deleteTask`: המשימה נמחקה, המיקומים של השאר רציפים 0..N-1 בסדר הקודם; מחיקה שנייה → `TaskNotFoundError`.
- מחיקה ויצירה במקביל: אין מיקומים כפולים, המשימה החדשה בסוף.

### 6.5 E2E ב-Chrome – `tests/e2e/edit.spec.ts`, `tests/e2e/delete.spec.ts` (Desktop + Mobile, מול `vercel dev` ו-Dev)
- עריכת כותרת/תיאור/תאריך ושמירה → הודעת הצלחה, השורה מתעדכנת, הערכים נשארים אחרי Refresh.
- משימה עם תאריך יעד שעבר (הוזנה במסד): שמירה בלי לשנות תאריך מצליחה; בחירת תאריך אחר בעבר נחסמת עם הודעה.
- שינוי ללא שמירה ואז: בחירת משימה אחרת / מעבר לאודות / Refresh → הערכים המקוריים חוזרים.
- שגיאת שרת מדומה (`page.route` ל-PATCH ול-DELETE) → הודעה, הערכים/המשימה נשארים, ניסיון חוזר מצליח.
- מחיקה: ביטול (כפתור, Esc, Overlay) משאיר; אישור מוחק, האזור חוזר להודעת הבחירה, והמשימה לא חוזרת אחרי Refresh.
- **שתי שמירות מקבילות דרך ה-API האמיתי** (`request.patch` פעמיים) – הערך הסופי הוא של התשובה האחרונה, `completed`/`position` לא השתנו.
- במובייל: השדות והכפתורים ברוחב המסך, וה-Modal נראה כולו.

### 6.6 בדיקות כלליות לפני סיום
`npm run typecheck`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:e2e` – כולל כל בדיקות M1–M2 (רגרסיה). בדיקה ויזואלית מול `DESIGN.md` 1.2/1.4 בצילומי מסך בדסקטופ ובמובייל.

## 7. מיפוי ל-Definition of Done

| תנאי | איך מאומת |
|---|---|
| עריכה ושמירה נשמרות במסד, הודעת הצלחה, נשמר אחרי Refresh | 6.3, 6.4, 6.5 |
| תאריך שמור בעבר – שמירה בלי שינוי מותרת; שינוי לתאריך אחר בעבר נחסם | 6.1, 6.2, 6.4, 6.5 |
| מעבר משימה / אודות / Refresh מבטלים טיוטה ללא התראה | 6.3, 6.5 |
| כישלון שמירה או Validation – שגיאה, התוכן נשאר | 6.3, 6.5 |
| מחיקה: אישור נפתח, ביטול משאיר, אישור מוחק רק אחרי הצלחת השרת | 6.3, 6.5 |
| אחרי מחיקה – האזור חוזר להודעת הבחירה; כישלון לא מסיר מהתצוגה | 6.3, 6.5 |
| שמירות מקבילות – האחרונה קובעת; אין דריסה של סטטוס או סדר | 6.4, 6.5 |
| מראה השדות וה-Modal לפי `DESIGN.md`; בדיקות קודמות עוברות | 5.7, 6.5, 6.6 |

## 8. החלטות שיתועדו כ-ADR במהלך הבנייה

- ADR-18: Validation של עדכון בתוך ה-Transaction (פונקציית `validate` שמקבלת את התאריך השמור) ופענוח מחמיר של `PATCH`.
- ADR-19: הודעת כישלון מחיקה בתוך חלון האישור; אפשרויות `closeOnOverlayClick`/`showCloseIcon` ב-`Modal`; טיוטת העריכה מאופסת דרך `key` של המשימה.
- כל החלטה נוספת שתתקבל בבנייה.

## 9. נקודות לתשומת לב

- לוודא שהנתיב הדינמי `api/tasks/[id]/index.ts` עובד ב-`vercel dev` מקומית (ובהמשך ב-Vercel) לפני כתיבת שאר הקוד.
- `204` ללא גוף – `tasksApi.deleteTask` לא קורא `response.json()`.
- `HomePage` אינו צריך להעביר ל-`TaskDetails` שינויים של `completed` – אבל המבנה (טיוטה עצמאית + `key`) צריך להישאר תקין כש-M4 יוסיף Checkbox.
- נוסחי ההודעות מילה במילה מ-PRD 4.ג.
- בדיקות ה-Integration וה-E2E משנות זמנית את נתוני Dev ומשחזרות אותם בסיום; לעולם לא מול Production.
