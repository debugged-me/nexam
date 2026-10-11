# NEXAM — On-Demand Animated Help Guide

> **Implementation brief for Codex.** Implement the feature in the **existing NEXAM project**. This is **not** for SRMS.

## Non-negotiable behavior: MANUAL START ONLY

**The guide must NEVER launch automatically.** The default behavior is: **the user clicks the Help button, and the guided tour starts immediately.** If NEXAM already uses its Help button to open an established Help menu, preserve that behavior and add a clearly labeled **Start Guided Tour** action inside it; that action must also require an explicit click.

This means:

- **Do not start** a tour on first login, sign-up, initial page load, dashboard load, page refresh, route change, examination start, tab switch, or after an update.
- **Do not start** based on a database flag, localStorage value, sessionStorage value, onboarding status, or incomplete tutorial state.
- **Do not call `driverObj.drive()`** (or an equivalent tour-start function) from `DOMContentLoaded`, `window.onload`, framework lifecycle hooks, AJAX success callbacks, global initializers, or route listeners.
- It is fine to **initialize the Help button** and register event listeners when the page loads. **Initializing is not starting.**
- Each new tour session must follow a real user action on the Help UI. On closing or finishing the guide, return to the ordinary NEXAM interface; do not reopen it automatically.
- If the page changes or reloads, clean up the active tour. Do not auto-resume it on the new page. Users can start Help again manually.
- Completion or dismissal tracking is optional, and **must not change the manual-start rule**.

**Example of desired behavior:** User clicks **Help** → guided tour begins. The user can close the tour at any time and run it again later. An existing Help menu may instead offer a **Start Guided Tour** option, but the tour still must not start until clicked.

## Objective

Build an attractive, responsive, lightweight, **free/open-source** interactive Help system for NEXAM. It should explain the actual buttons, areas, and workflows of the existing application using overlays, element highlighting, helpful instructions, progress indicators, and optionally an animated professor/guide mascot. It must not interfere with legitimate examinations or change current examination logic.

## Free technologies

1. **Driver.js** — highlights target UI elements and controls tour steps. Official docs: https://driverjs.com/docs/installation and https://driverjs.com/docs/configuration
2. **lottie-web** — optionally displays a small animated assistant using an appropriately licensed Lottie JSON animation. Official repository: https://github.com/airbnb/lottie-web
3. **Native JavaScript and existing project tooling** — use the frameworks, styles, and asset pipeline already in NEXAM. Do not migrate frameworks just for this feature.
4. **Optional**: Web Speech API for a user-activated narration toggle, **off by default**. Do not add a paid AI service or voice API.

Use locally hosted/pinned library versions or the existing package manager and build pipeline. Do not rely on `@latest` CDN URLs in production. Observe third-party asset licenses. If no suitable free/licensed Lottie file is present, create a minimal CSS/SVG animated guide avatar as a fallback; do not download arbitrary proprietary character assets.

## Step 1 — Inspect NEXAM before modifying anything

Inspect the real repository and identify:

- Technology stack, dependency management, shared layouts, UI components, and route/page organization.
- Existing Help buttons/menus, navigation items, icons, tooltips, support pages, and accessibility conventions. Reuse an existing Help button if available; do not create duplicates.
- Actual user roles and permissions. Only build help tours for roles and screens that truly exist.
- Actual examination lifecycle: exam listing, instructions, starting, answering, navigation, timer, review, submission, and results, **where present**.
- Whether a sandbox/demo/practice examination or preview mode exists.
- Security requirements and any exam integrity restrictions (fullscreen, proctoring, active timers, attempt limits, etc.).

**Do not assume NEXAM uses CodeIgniter, SRMS routes, SRMS tables, or SRMS role names.** Inspect and adapt to the actual implementation. Do not invent controllers, endpoints, selectors, tables, or workflows.

## Step 2 — Implement the Help entry point

- Reuse the current **Help** button if NEXAM already has one.
- Otherwise add a clearly labeled and accessible **Help** button in the appropriate shared header, sidebar, or responsive layout, matching NEXAM's existing design.
- **Preferred: Clicking Help directly starts the tour** for the current page. If the existing NEXAM Help button must keep its current menu/modal behavior, add a **Start Guided Tour** action there instead. Both approaches require a deliberate user click to start.
- Provide **Close**, **Previous**, **Next**, and **Finish** controls where appropriate.
- The Help UI should be keyboard accessible, usable on mobile, and not obscure crucial examination buttons.
- If there are no valid guide steps for the current page, explain that help is unavailable here rather than opening an empty tour.

### Mandatory event-flow example (adapt to project stack)

```javascript
// Illustrative only: replace selectors, imports, and handlers with NEXAM's real code.
// Loading the page registers controls but NEVER starts a tour.

const helpButton = document.querySelector('[data-nexam-help]');
let activeTour = null;

helpButton?.addEventListener('click', () => {
  // A deliberate Help button click is the ONLY entry point that starts a tour.
  const steps = getStepsForCurrentNexamPage();
  if (!steps.length) return showNoHelpAvailableMessage();

  activeTour?.destroy();
  activeTour = driver({
    showProgress: true,
    allowClose: true,
    steps
  });
  activeTour.drive();
});

// If NEXAM already has a Help menu, attach this same handler to its
// explicit "Start Guided Tour" item, not to any page-load event.

window.addEventListener('pagehide', () => {
  activeTour?.destroy();
  activeTour = null;
});

// Deliberately NO auto-start code in DOMContentLoaded, onload, or route hooks.
```

The example is conceptual: import `driver` correctly for NEXAM's installed package or pinned local asset. If using dynamic page navigation, clean up on the framework's appropriate unmount/route-change hooks too.

## Step 3 — Build reusable, page-aware help tours

Create a small, centralized guide manager rather than scattered hard-coded scripts. It should:

- Register tour definitions by the **actual** NEXAM route/page, role, and visible interface.
- Resolve the currently visible, permitted elements only.
- Prefer stable `data-tour` attributes over fragile CSS selectors or positional/nth-child selectors.
- Skip gracefully when an element is absent, hidden, disabled, or inaccessible to the current role.
- Wait for dynamic content (e.g., tabs, modals, AJAX-rendered buttons) **only after the user has initiated a tour**. Never force real transactions to happen.
- Prevent double starts, event-listener duplication, orphaned overlays, focus traps, and stale tour instances.
- Clean up listeners, overlays, and animations on dismissal, route change, and unmount.
- Keep guide text concise and grounded in the real screen and the existing application behavior.

Suggested components/files, adapted to the real architecture:

- A shared Help button/menu component or partial.
- A reusable guide-manager module.
- Separate tour definitions for actual pages/roles.
- Small isolated styles for overlays and the assistant mascot.
- Optional local animation assets.

## Step 4 — NEXAM exam-specific safeguards

**Never let a tutorial initiate, answer, submit, reset, or alter a real examination automatically.**

- If a practice/demo mode exists, demonstrate exam actions there using safe, non-production attempts.
- If practice mode does not exist, use **explanatory-only** highlights for the exam workflow. Do not create real attempts, submit exams, change scores, or generate fake result records just to demo the tour.
- Never click **Start Exam**, **Submit Exam**, **End Attempt**, **Reset**, or similar sensitive actions programmatically.
- During an **active timed/proctored exam**, respect NEXAM's exam integrity rules. Prefer concise contextual Help that does not pause timers, obscure questions, reveal answers, alter focus requirements, or trigger navigation. If the existing rules prohibit help overlays, display a non-disruptive explanation or hide guided tours on that page while keeping an appropriate Help option.
- A guided step requiring interaction may advance only after a **safe, non-destructive** user action. Do not block the entire examination interface with mandatory steps.
- Maintain normal CSRF protection, authorization, anti-cheating controls, exam timers, and audit behavior. The guide must not bypass permissions.

Possible help topics, **only if these elements actually exist**:

1. Dashboard and available examinations.
2. Finding an exam and reading its instructions.
3. Understanding question types and answering controls.
4. Navigating questions and locating unanswered items.
5. Reading timer/progress information.
6. Reviewing answers and understanding the submission confirmation.
7. Finding results or feedback when available.

Implement a functional tour on one representative NEXAM screen first, then add other existing screens following the same pattern.

## Step 5 — Animated helper (optional, non-blocking enhancement)

- Show an approachable instructor/assistant avatar **only while Help or an active tour is open**.
- Use `lottie-web` with a verified free-to-use animation. If that is unavailable, show a lightweight CSS/SVG mascot without blocking launch of the basic tour.
- Position it near, but not over, the currently highlighted control; ensure mobile-safe positioning.
- Animate minimally (idle, point, wave) and respect `prefers-reduced-motion`.
- Keep narration **off by default**. If added, require the user to enable it and provide a mute/stop control.
- Unload/pause the animation when Help closes. Avoid repeated downloads or unnecessary animation on ordinary page loads.
- Ensure the helper does not suggest it knows exam answers or grant privileged help during a live assessment.

## Step 6 — Accessibility, performance, and compatibility

- Support mouse, touch, and keyboard where practical; ensure focus and ARIA labels are meaningful.
- Do not trap keyboard focus after the tour closes; return focus to the Help button when appropriate.
- Avoid excessive overlay z-index conflicts with modals, dropdowns, and mobile menus.
- Escape closes the tour unless doing so conflicts with an existing exam-specific interaction.
- Respect responsive breakpoints and reduced-motion settings.
- Load assets efficiently; prefer local assets and the project's existing bundler/caching approach.
- Do not add external analytics, tracking, paid subscriptions, AI APIs, or unnecessary database tables.
- Prefer client-side, page-local state; persist completion status only if NEXAM already has a relevant safe convention and it has a specific purpose. **Never persist a flag that auto-starts Help.**

## Validation and acceptance checklist

Verify all of the following in NEXAM itself:

- [ ] **Login does not start a tour.**
- [ ] **First login does not start a tour.**
- [ ] **Refresh does not start a tour.**
- [ ] **Navigating between pages does not start a tour.**
- [ ] **Starting an examination does not start a tour.**
- [ ] **Returning after closing a tour does not auto-start it.**
- [ ] Clicking **Help** directly starts the guided tour (preferred behavior).
- [ ] If an existing Help menu is preserved, clicking its **Start Guided Tour** item starts the tour; simply loading the menu does not start it.
- [ ] Clicking **Close** or **Finish** fully removes the overlay and mascot.
- [ ] Help can be opened repeatedly without duplicated UI or listeners.
- [ ] Step targets correspond to actual, visible NEXAM UI controls.
- [ ] Tour works where intended for desktop and mobile layouts.
- [ ] Missing or role-restricted elements do not cause errors.
- [ ] Existing exam timer, answers, exam permissions, proctoring, and submission flows remain unchanged.
- [ ] No guide action starts or submits real exams or modifies answers.
- [ ] No new paid service or subscription is required.
- [ ] Relevant automated tests and existing build/test checks pass; report anything that could not be tested.

## Codex execution instructions

1. **Inspect the repository first**, then implement the feature with minimal, targeted changes.
2. Implement a **usable vertical slice**: Help-button click → manually started Driver.js tour → safe dismissal/restart. Add the animated helper if an appropriate free asset is available; otherwise implement the fallback.
3. Expand to other real NEXAM pages only after the basic reusable component works.
4. Preserve all existing routes, authentication, examination flows, visual conventions, responsive behavior, and business logic.
5. If a database migration or new dependency is necessary, explain why and keep the change minimal. Avoid a migration if client-side state is sufficient.
6. Run practical validation and test the **manual-start-only** cases above.
7. At the end, list every modified/added file, explain how to use Help, indicate what is complete vs. pending, and provide exact installation/build steps if needed.

### Final priority

**The guide starts when the user clicks Help, and never automatically. A reliable, manually triggered guide is more important than advanced animation. Under no circumstances implement auto-launch onboarding.**
