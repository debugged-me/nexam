# nexam — Project Guidelines

## Icons

**Always use [Lucide](https://lucide.dev/icons/) icons only.** Do not use any other icon set (Material Icons, Font Awesome, AI-generated SVGs, emoji-as-icons, etc.).

Usage via CDN:
```html
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="icon-name"></i>
<script>lucide.createIcons();</script>
```

Do not reference any other icon library in code, comments, or documentation.

## CSS

**CSS must be in separate files under `assets/css/`, not embedded in `<style>` tags inside views.** This keeps styles shared and easy to modify across pages.

- Page-specific CSS: `assets/css/<page-name>.css` (e.g. `auth.css`, `dashboard.css`)
- Shared component CSS: `assets/css/app.css` (already exists)
- Only use inline `<style>` when a style is truly one-off and cannot be reused
- Link CSS files via `base_url('assets/css/...')` in views

## JavaScript

**JS must be in separate files under `assets/js/`, not embedded in `<script>` tags inside views.**

- Page-specific JS: `assets/js/<page-name>.js` (e.g. `auth.js`)
- Link JS files via `base_url('assets/js/...')` in views

## Responsive Design

**All pages must be responsive and work on any screen size.** When building new features, follow these rules:

- Use mobile-first breakpoints (`@media (min-width: ...)`) or sensible max-width breakpoints
- Test at minimum: mobile (380px), tablet (768px), desktop (1024px+)
- Use relative units (rem, %, vw/vh) over fixed px where possible
- Use CSS Grid / Flexbox for layouts — never tables for layout
- Ensure tap targets are at least 44x44px on mobile
- The auth pages (`auth.css`) are the reference implementation — follow that pattern

## Code Style

- Follow existing CodeIgniter 3 conventions in the codebase
- Use `site_url()` for controller routes, `base_url()` for asset paths
- Never commit `.DS_Store` files (already in `.gitignore`)
