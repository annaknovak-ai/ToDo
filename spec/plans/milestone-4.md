# תוכנית – Milestone 4: סטטוס ביצוע וסדר ידני

**מקורות:** `MILESTONES.md` (Milestone 4), `PRD.md` (זרימות 4–5, FR-05–FR-07, נוסחי הודעות), `ARCHITECTURE.md` (2.2, 2.4–2.6, 2.10, ADR-9, ADR-19), `DESIGN.md` (1.1, 1.6, 2.3), `wireframes.png`.

**אין שינוי במבנה מסד הנתונים** ב-Milestone הזה: העמודות `completed` ו-`position` כבר קיימות. לכן אין Migration חדשה, ובדחיפה לא יוחל שום שינוי על Production. אין משתני סביבה חדשים.

## 1. הגישה בקצרה

- **סטטוס:** Checkbox פעיל בכל שורה ← `PATCH /api/tasks/:id/status` עם `{completed}` מפורש. עדכון שורה אחת, ללא Advisory Lock (ADR-9). בלקוח: סימון מיידי (אופטימי), ובכישלון החזרה של `completed` של אותה משימה בלבד + הודעה.
- **סדר:** ידית גרירה בכל שורה, `@dnd-kit/core` + `@dnd-kit/sortable` ← בסיום גרירה `PUT /api/tasks/order` עם כל המזהים בסדר החדש. בשרת: Transaction + אותו Advisory Lock של יצירה/מחיקה, אימות קבוצת המזהים אחד-לאחד, עדכון מיקומים ל-0..N-1 בשאילתה אחת. באי-התאמה `409 ORDER_CONFLICT` בלי לשנות דבר. בלקוח: סדר מיידי, ובכישלון החזרת הסדר הקודם בלבד + הודעה; ב-`409` גם כפתור **"רענן את הרשימה"**.
- **טיוטת עריכה:** כבר כיום `TaskEditor` מורכב עם `key={task.id}` ומאותחל פעם אחת (ADR-19), ו-`handleSaved` מעדכן רק שדות פרטים. סימון או גרירה משנים רק `completed`/`position` ב-State, ולכן הטיוטה נשארת כמות שהיא ואינה נשמרת. ייבדק בבדיקות.
- **ללא Polling/Real-Time:** אין טעינה ברקע. הרשימה נטענת בכניסה לדף, ב-Refresh, או בלחיצה על "רענן את הרשימה" אחרי `409`.

## 2. Backend

### 2.1 `server/http.ts`
- להעביר לכאן מ-`server/taskHandler.ts` את בדיקת ה-UUID כעזר משותף `requireTaskId(req, res): string | null` (מחזיר `400 INVALID_REQUEST` במזהה לא תקין), ואת `TASK_NOT_FOUND_MESSAGE`. `taskHandler.ts` ישתמש בהם (ללא שינוי התנהגות).

### 2.2 `server/tasksRepository.ts`
- מחלקת שגיאה חדשה `TaskOrderConflictError`.
- `setTaskCompleted(id, completed): Promise<Task>` – שאילתה אחת:
  `update public.tasks set completed = $2, updated_at = now() where id = $1 returning ...`; 0 שורות ← `TaskNotFoundError`. לא נוגע בשדות הפרטים או ב-`position`.
- `reorderTasks(orderedIds): Promise<Task[]>` – בתוך `inTransaction`:
  1. `select pg_advisory_xact_lock($1)` עם `TASKS_LIST_LOCK_KEY`.
  2. `select id from public.tasks` – השוואה: אותו מספר פריטים, אין כפילויות במערך שנשלח, וכל מזהה קיים ← אחרת `TaskOrderConflictError` (ה-Transaction מתבטלת, אין שינוי).
  3. עדכון אחד:
     `update public.tasks t set position = o.ord - 1 from unnest($1::uuid[]) with ordinality as o(id, ord) where t.id = o.id and t.position <> o.ord - 1`.
     (כמו נרמול המחיקה, שינוי סדר אינו מזיז את `updated_at`.)
  4. החזרת הרשימה המלאה לפי `position, id`.
- לעדכן את ההערה ליד `TASKS_LIST_LOCK_KEY` (יצירה, מחיקה ושינוי סדר).

### 2.3 Handlers חדשים
- **`server/taskStatusHandler.ts`** – `createTaskStatusHandler(getRepository)`:
  - רק `PATCH` (אחרת `405`); מזהה תקין (`400`); `requireJsonBody` עד 16KB.
  - גוף חייב להיות אובייקט עם `completed` מסוג `boolean` (לא Toggle, לא מחרוזת) ← אחרת `400`. שדות אחרים מתעלמים מהם.
  - הצלחה `200` + המשימה; `TaskNotFoundError` ← `404 TASK_NOT_FOUND`; אחר ← `sendServerError`.
- **`server/taskOrderHandler.ts`** – `createTaskOrderHandler(getRepository)`:
  - רק `PUT`; `requireJsonBody` עד **64KB** (ADR-9).
  - `orderedIds` חייב להיות מערך של עד `MAX_TASKS` מחרוזות UUID ← אחרת `400`.
  - הצלחה `200` + הרשימה בסדר החדש; `TaskOrderConflictError` ← `409 ORDER_CONFLICT` עם ההודעה "הרשימה השתנתה בינתיים. רענן כדי לראות את הגרסה העדכנית."; אחר ← `sendServerError`.

### 2.4 נתיבי Vercel
- `api/tasks/[id]/status.ts` ← `createTaskStatusHandler(() => createTasksRepository(getPool()))`.
- `api/tasks/order.ts` ← `createTaskOrderHandler(...)`. נתיב סטטי, אמור לגבור על `[id]` (ADR-9) – לאמת ב-`vercel dev` בבדיקת E2E/API (`PUT /api/tasks/order` לא מגיע ל-Handler של משימה בודדת ומחזיר `405`).

## 3. Frontend

### 3.1 תלויות
- `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` (גרסה Major עדכנית, ב-Lockfile). אין `@dnd-kit/modifiers`: הגבלה לציר האנכי תמומש כפונקציית Modifier קצרה (`x: 0`).

### 3.2 `src/api/tasksApi.ts`
- `setTaskStatus(id, completed): Promise<Task>` – `PATCH /api/tasks/:id/status`.
- `saveTaskOrder(orderedIds): Promise<Task[]>` – `PUT /api/tasks/order`.
- שתיהן זורקות `ApiRequestError` כמו הפעולות הקיימות.

### 3.3 `src/messages.ts` ו-`src/lib/apiErrors.ts`
- הודעות חדשות (נוסח מדויק מ-PRD 4.ג): `statusFailed` – "לא הצלחנו לעדכן את סטטוס המשימה. נסה שוב.", `orderFailed` – "לא הצלחנו לשמור את הסדר החדש. נסה שוב.", `orderConflict` – "הרשימה השתנתה בינתיים. רענן כדי לראות את הגרסה העדכנית.", `refreshList` – "רענן את הרשימה".
- עזר חדש `listActionMessage(error, fallback): string` לפעולות ברשימה: `404 TASK_NOT_FOUND` ← `taskGone`; `409 ORDER_CONFLICT` ← `orderConflict`; `429` ← `tooManyRequests`; אין חיבור ← `offline`; אחרת `fallback`.

### 3.4 `src/lib/taskOrder.ts` (פונקציות טהורות, עם Unit Tests)
- `moveTask(tasks, activeId, overId)` – `arrayMove` ומספור `position` מחדש לפי האינדקס.
- `applyOrder(tasks, orderedIds)` – מסדר את הרשימה הנוכחית לפי סדר מזהים (לשחזור אחרי כישלון). משימות שאינן ברשימת המזהים נשארות בסוף לפי סדרן, ומזהים שאינם ברשימה מתעלמים מהם – כך יצירה/מחיקה שהסתיימו בינתיים אינן הולכות לאיבוד.
- `withServerPositions(tasks, saved)` – אחרי הצלחה לוקח מהתשובה רק את `position`, כדי לא לדרוס `completed` שעדיין בשמירה.

### 3.5 `src/pages/HomePage.tsx`
State חדש:
- `pendingStatusIds: Set<string>` – Checkbox של משימה מושבת עד שבקשת הסטטוס שלה מסתיימת (ADR-9).
- `orderSaving: boolean` – גרירה נוספת מושבתת עד שהשמירה הקודמת מסתיימת.
- `listNotice: { message: string; canRefresh: boolean } | null` – הודעת שגיאה לפעולות ברשימה.

פעולות:
- `handleToggle(id, completed)` – מנקה `listNotice`, מעדכן מיד `completed`, שולח. הצלחה: מעדכן מהתשובה רק את `completed`. כישלון: מחזיר את `completed` של אותה משימה לערך הקודם ומציג `listActionMessage(error, statusFailed)`.
- `handleReorder(activeId, overId)` – אם `orderSaving` או אין שינוי, לא עושה דבר. שומר את סדר המזהים הקודם, מחיל `moveTask`, שולח את כל המזהים. הצלחה: `withServerPositions`. כישלון: `applyOrder(current, previousIds)` והודעה; ב-`409` עם `canRefresh: true`.
- `refreshList()` – אותה טעינה כמו בכניסה לדף (מצב טעינה ← רשימה/שגיאה), מנקה את `listNotice`. הבחירה נשמרת אם המשימה הנבחרת עדיין קיימת (ואז גם הטיוטה, כי ה-Editor לא מתחלף), אחרת מתאפסת. טעינת הכניסה תועבר לפונקציה משותפת זו.
- הסימון והגרירה לא נוגעים ב-`selectedId` ולא ב-`TaskDetails`.

### 3.6 `src/components/TaskList.tsx`
- עוטף את הרשימה ב-`DndContext` + `SortableContext` (`verticalListSortingStrategy`), עם:
  - `PointerSensor` (עכבר ומגע) עם `activationConstraint: { distance: 5 }`, ו-`KeyboardSensor` עם `sortableKeyboardCoordinates`.
  - Modifier לציר אנכי בלבד; `onDragEnd` ← `onReorder(active.id, over.id)`.
  - הודעות קורא מסך בעברית (`accessibility.announcements` + `screenReaderInstructions`), למשל "המשימה הורמה. השתמש בחצים כדי להזיז אותה ובמקש רווח כדי להניח אותה."
- הודעת `listNotice` מוצגת בראש אזור הרשימה (`role="alert"`, בסגנון השגיאה הקיים), וכשיש `canRefresh` – כפתור משני **"רענן את הרשימה"** לצדה.
- Props חדשים: `pendingStatusIds`, `dragDisabled`, `notice`, `onToggle`, `onReorder`, `onRefresh`.

### 3.7 `src/components/TaskRow.tsx`
- `useSortable({ id, disabled: dragDisabled })`; `setNodeRef` + `transform`/`transition` על ה-`<li>`; מחלקה `is-dragging` בזמן גרירה.
- **סדר הרכיבים בשורה לפי ה-Wireframe** (מימין לשמאל): טקסט המשימה, Checkbox, ידית גרירה. כיום ה-Checkbox מופיע מימין לטקסט; הסדר ב-DOM יהיה: כפתור הבחירה, Checkbox, ידית.
- Checkbox פעיל: `onChange` ← `onToggle(task.id, e.target.checked)`, `disabled` כשהבקשה שלו בדרך. `aria-label` – טקסט המשימה (המצב נקרא מ-`checked`), במקום "הושלמה"/"לביצוע". מחלקת `is-completed` נשארת (טקסט חצוי), והשורה לא זזה.
- ידית גרירה: `<button type="button" className="drag-handle">` עם `setActivatorNodeRef`, `listeners`, `attributes`, `aria-label="גרור כדי לשנות את הסדר"`, אייקון קו פשוט (שש נקודות, SVG פנימי). הגרירה מתחילה רק מהידית, ולכן לחיצה על הטקסט או על ה-Checkbox אינה גוררת, וגרירה אינה בוחרת שורה או מסמנת Checkbox.

### 3.8 `src/styles.css`
- `.drag-handle`: יעד מגע של לפחות 40×40px, `touch-action: none`, `cursor: grab` (`grabbing` בזמן גרירה), צבע `text-secondary` ו-Hover עדין; מצב מושבת מעומעם.
- `.task-checkbox`: `cursor: pointer`, Focus כחול, מצב `disabled` (בזמן שמירה) מעומעם מעט.
- `.task-row.is-dragging`: רקע Surface, צל רך (`0 2px 8px rgba(0,0,0,0.08)`), `position: relative; z-index: 1`.
- `.list-notice` להודעת הרשימה וכפתור הרענון. ליטוש סופי שייך ל-Milestone 5.

## 4. בדיקות

### 4.1 Unit / Component (`npm test`)
- `server/taskStatusHandler.test.ts`: `405`; מזהה לא תקין `400`; Content-Type שגוי `400`; `completed` חסר/לא Boolean `400`; `404`; הצלחה `200` ו-`Cache-Control: no-store`; שגיאה כללית `500`.
- `server/taskOrderHandler.test.ts`: `405`; גוף לא תקין / לא מערך / מזהה לא UUID / יותר מ-1,000 ← `400`; מעל 64KB ← `413`; גוף של 1,000 UUID מתקבל; `409 ORDER_CONFLICT`; הצלחה `200`.
- `src/lib/taskOrder.test.ts`: `moveTask`, `applyOrder` (כולל משימה שנוספה/נמחקה בינתיים), `withServerPositions`.
- `src/components/TaskRow.test.tsx` / `src/App.test.tsx` (Fetch מדומה):
  - Checkbox מסמן ומבטל, נשלחת בקשה עם הערך המפורש, השורה לא זזה.
  - Checkbox מושבת בזמן הבקשה.
  - כישלון ← ה-Checkbox חוזר, מוצגת "לא הצלחנו לעדכן את סטטוס המשימה. נסה שוב.".
  - טיוטה שלא נשמרה באזור הפרטים נשארת אחרי סימון ה-Checkbox של אותה משימה, ולא נשלחת בקשת `PATCH` לפרטים.
  - בכל שורה ידית גרירה עם התווית הנכונה; לחיצה עליה לא בוחרת משימה.
- עדכון בדיקות קיימות שהניחו Checkbox מושבת.

### 4.2 Integration מול Dev (`npm run test:integration`, ADR-7)
- `setTaskCompleted`: הלוך-חזור; לא משנה כותרת/תיאור/תאריך/`position`; משימה לא קיימת ← `TaskNotFoundError`.
- `reorderTasks`: שומר את הסדר המדויק במיקומים 0..N-1 (גם אחרי פערים במיקומים); מזהה חסר, מזהה נוסף, כפילות או מזהה של משימה שנמחקה ← `TaskOrderConflictError` והטבלה ללא שינוי; רשימה ריקה עם `[]` מצליחה.
- מקביליות (שני Pools):
  - שתי גרירות מקבילות של אותה קבוצה ← התוצאה היא בדיוק אחד משני הסדרים, מיקומים רציפים וללא כפילויות.
  - גרירה במקביל ליצירה ← או שהגרירה מצליחה והמשימה החדשה בסוף, או שהגרירה נדחית ב-`TaskOrderConflictError`; בכל מקרה אף משימה לא אבדה ואין מיקום כפול.
  - גרירה במקביל למחיקה ← אותו דבר.
  - סטטוס במקביל לגרירה ← שני השינויים נשמרים.

### 4.3 E2E ב-Playwright (`npm run test:e2e`, Desktop Chrome + Mobile Chrome) – `tests/e2e/status.spec.ts`, `tests/e2e/reorder.spec.ts`
- Checkbox: סימון וביטול, השינוי במסד, אחרי Refresh הערך נשמר והמשימה באותו מקום.
- גרירה בעכבר (Desktop) דרך הידית, כולל משימה שהושלמה ← הסדר במסד מדויק ורציף, ונשמר אחרי Refresh.
- **גרירה במגע** ב-Mobile Chrome: אירועי Touch אמיתיים דרך CDP (`Input.dispatchTouchEvent`) על הידית ← הסדר נשמר. בנוסף: הקשה על הידית אינה מסמנת Checkbox ואינה בוחרת משימה.
- טיוטה: עריכת כותרת בלי לשמור ← סימון Checkbox וגרירה של אותה משימה ← הטקסט שהוקלד עדיין בשדה, והמסד לא השתנה בפרטים.
- תקלה בשרת (`page.route` ← `500`): ה-Checkbox חוזר + הודעה; הסדר חוזר + "לא הצלחנו לשמור את הסדר החדש. נסה שוב.".
- `409`: הוספת משימה ישירות במסד אחרי טעינת הדף, ואז גרירה ← הודעת "הרשימה השתנתה בינתיים..." וכפתור "רענן את הרשימה", הסדר במסד לא השתנה; לחיצה על הכפתור מציגה את הרשימה העדכנית כולל המשימה החדשה.
- בקשות API ישירות: `PATCH .../status` ו-`PUT /api/tasks/order` (כולל `409` ו-`400`), ש-`/api/tasks/order` לא נבלע ב-SPA Fallback או בנתיב `[id]`.
- מבקר אחר: שינוי סטטוס/סדר בחלון שני מופיע בחלון הראשון רק אחרי Refresh; אין בקשות `GET /api/tasks` נוספות בזמן המתנה (אין Polling).
- כל בדיקות ה-E2E הקיימות (צפייה, יצירה, עריכה, מחיקה, ניווט) עוברות.

### 4.4 בדיקה ידנית שלך
- גרירה במגע בטלפון Android אמיתי ב-Chrome אפשרית רק אחרי שהאתר פרוס, או ברשת המקומית; הבדיקה האוטומטית מדמה מגע. אציין זאת בסיום הבנייה.

## 5. ADRs שיתועדו ב-ARCHITECTURE.md בזמן הבנייה
- **ADR-20:** מיקום הודעות השגיאה של סטטוס וסדר בראש אזור הרשימה (DESIGN לא מגדיר מיקום), וכפתור "רענן את הרשימה" שטוען מחדש את הרשימה בלי Refresh של הדף ושומר את הבחירה כשהמשימה עדיין קיימת.
- **ADR-21:** כפילויות ב-`orderedIds` נחשבות אי-התאמה (`409`), ומבנה לא תקין (`400`); שינוי סדר אינו מעדכן `updated_at`; הגבלת ציר אנכי בלי חבילת `@dnd-kit/modifiers`.

## 6. Definition of Done – איך כל תנאי ייבדק

| תנאי | בדיקה |
|---|---|
| Checkbox מסמן ומבטל, נשמר מיד, לא משנה מיקום | E2E סטטוס + Component |
| משימות שהושלמו באותה רשימה וניתנות לגרירה | E2E גרירה של משימה שהושלמה |
| סימון/גרירה בזמן עריכה שלא נשמרה משאירים את הטיוטה | Component + E2E טיוטה |
| Drag & Drop בעכבר ובמגע, בלי להפעיל Checkbox/בחירה | E2E Desktop + Touch ב-Mobile Chrome; ידנית בטלפון |
| אחרי גרירה ו-Refresh הסדר מדויק ורציף | E2E + Integration |
| Integration: Transaction אטומית ביצירה/מחיקה בזמן שינוי סדר ובשתי גרירות | Integration מקביליות |
| קבוצת מזהים שהשתנתה ← `409`, בלי אובדן או סדר חלקי | Integration + E2E `409` |
| תקלה בשרת מחזירה Checkbox/סדר + חיווי | Component + E2E `500` |
| שינויי מבקר אחר אחרי Refresh בלבד; היכולות הקודמות עובדות | E2E שני חלונות + כל הבדיקות הקיימות |

## 7. סיום
- `npm run typecheck`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:e2e` עוברים.
- סימון 🟡 ליד Milestone 4 ב-`MILESTONES.md`. ללא commit. הרצת הבדיקה שלי נסגרת בסיום.
