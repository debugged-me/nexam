# Nexam web

React and Vite instructor workspace. The Node API in `../api` is the only backend.

Run `npm run dev` from this directory, or `npm run dev` at the repository root to
start both servers. Verify web changes with `npm run build` and `npm run lint`.

## Editing a screen

Each page imports its own CSS file from `src/styles/`. Page layout rules live
inside `@scope (.page--<name>)`; the page passes that name as `pageClass` to
`AppShell`. This wrapper only supplies route metadata and the CSS boundary.
The actual content layout stays in the page's JSX and stylesheet.

List, detail, and form screens are independent. For example:

| Screen | Component | Stylesheet |
| --- | --- | --- |
| Overview | `DashboardPage.jsx` | `dashboard.css` |
| Subjects | `SubjectsPage.jsx` | `subjects.css` |
| Question bank | `QuestionsPage.jsx` | `questions.css` |
| Review queue | `ReviewQueuePage.jsx` | `review.css` |
| Exam list | `ExamsPage.jsx` | `exams.css` |
| Exam detail | `ExamDetailPage.jsx` | `exam-detail.css` |
| Exam form | `ExamFormPage.jsx` | `exam-form.css` |
| Blueprint list | `TosPage.jsx` | `tos.css` |
| Blueprint detail | `TosDetailPage.jsx` | `blueprint-detail.css` |

Authentication pages each have `auth-<page>.css`, scoped to their own root.
Use `:scope` when styling the scope root itself. Do not import a page's CSS
from another screen or add page styles to `App.jsx`.

Table and board rules are deliberately owned by each consuming page. Editing
`subjects.css` will not change the question bank or exams table. Some CSS is
duplicated to preserve this independence. Routes load their code and CSS on demand.

`tokens.css` provides fonts, colors, and spacing. `app.css` provides application
navigation and basic controls; dialog, toast, and loading primitives have their
own styles. These are the limited common foundations. Avoid putting new page
composition rules there.

Quick navigation opens with Cmd/Ctrl+K. It searches page names and descriptions,
not private instructor content. Respect reduced motion and verify pages at
380px, 768px, and 1024px or wider, including keyboard focus and mobile navigation.
