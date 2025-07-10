# OpenCode Configuration

## Build/Lint/Test Commands
- `dx serve` - Run development server with hot reloading (serves on http://localhost:8080)
- `dx build` - Build the project for production
- `dx run` - Run project without hot reloading  
- `cargo fmt` - Format Rust code
- `cargo clippy` - Run linter
- `cargo test` - Run tests
- `cargo test <test_name>` - Run specific test

## Recent Fixes Applied

### Blog/Projects Functionality Issues Fixed:
1. **Server Functions**: Converted file system operations to use Dioxus `#[server]` functions
   - `load_blog_post_server` for blog content loading
   - `get_blogs_server` for blog listing  
   - `get_projects_server` for project listing
   - `load_project_server` for project content loading

2. **Directory Structure**: 
   - Blog posts moved to `/blog/` directory 
   - Projects moved to `/projects/` directory
   - Separate routes for `/blog` (list) and `/blog/:id` (individual posts)
   - Separate routes for `/projects` (list) and `/projects/:id` (individual projects)

3. **CSS Blog Viewer Fix**:
   - Increased top margin in `.blog-container` to 60px 
   - Added padding-top to `.blog-content` to prevent content cutoff
   - Fixed z-index for title pseudo-element

4. **Light Mode Toggle**: 
   - Added theme toggle button in navbar
   - CSS variables switch between light/dark themes
   - Light mode CSS overrides in `:root.light-mode`
   - Custom cursor colors for both themes

5. **Component Updates**:
   - Created separate `BlogList` and `ProjectList` components
   - Added `BlogIndex` view for blog listing page
   - Created `ProjectDetail` component for individual project viewing
   - Updated navbar links to use new routing structure

### Latest Performance Optimizations (January 2025):
6. **Removed Debug CSS**: 
   - Deleted `/assets/styling/debug.css` file completely
   - Removed all debug overlays, borders, and color highlighting
   - Clean rendering without debug artifacts

7. **Improved Markdown Rendering**:
   - Removed excessive `!important` declarations from blog.css
   - Replaced janky typewriter animation with smooth `fadeInUp` animation
   - Added staggered content reveal for better UX
   - Added `prefers-reduced-motion` media query for accessibility

8. **Optimized Animations**:
   - Replaced moving scanlines background with static scanlines overlay
   - Replaced step-based typewriter with smooth fade-in transitions
   - Reduced animation complexity to improve performance
   - Added motion preference respect for accessibility

### Current Status:
- ✅ Build process working (dx build succeeds)
- ✅ Debug CSS removed
- ✅ Animations optimized for performance
- ✅ Markdown rendering improved
- ✅ Accessibility considerations added

## Project Structure
- **Retro Computing Theme**: Complete 80s/90s terminal aesthetic with CRT effects
- **Markdown Blog System**: Automatic rendering of `.md` files from `blog/` directory
- **Project Showcase**: Dynamic project loading from `projects/` directory  
- **Responsive Design**: Mobile-first approach with custom retro styling
- **Component Architecture**: Modular components with individual CSS files
- **Fullstack Architecture**: Server functions for file operations, client for UI

## Key Features Implemented
1. **Retro UI/UX**: 
   - Custom terminal-style cursors (with light mode variants)
   - Static CRT scanlines effect (improved performance)
   - Retro Mac window chrome
   - Matrix-style background effects
   - Smooth glitch animations and glow effects

2. **Blog System**:
   - Automatic markdown parsing with pulldown-cmark
   - Dynamic blog post loading from `/blog/*.md`
   - Blog listing at `/blog` route
   - Individual blog posts at `/blog/:id`
   - Syntax highlighting support
   - LaTeX math rendering ready (KaTeX integration planned)

3. **Project System**:
   - Automatic project discovery from `/projects/*.md`
   - Project listing at `/projects` route  
   - Individual project pages at `/projects/:id`
   - Separate from blog content

4. **Navigation**:
   - Clean routing with Dioxus Router
   - Responsive navbar with retro styling
   - Theme toggle button (light/dark mode)
   - Project and blog listing with automatic discovery

5. **Light/Dark Mode**:
   - Toggle button in navbar  
   - CSS variable-based theming
   - Automatic cursor color switching
   - Maintains retro aesthetic in both modes

6. **Performance Optimizations**:
   - Smooth CSS animations using `transform` and `opacity`
   - Reduced-motion accessibility support
   - Static effects where possible to reduce CPU usage
   - Clean markup without debug artifacts

## Code Style Guidelines
- Use `snake_case` for functions, variables, and modules
- Use `PascalCase` for structs, enums, and components
- Use `SCREAMING_SNAKE_CASE` for constants and statics
- Import organization: std first, then external crates, then local modules
- Components should be functions returning `Element`
- Use `rsx!` macro for JSX-like syntax
- Asset declarations use `Asset = asset!("/path")` pattern
- Error handling: use `Result<T, E>` and `?` operator
- Components in separate modules with `pub use` re-exports
- CSS assets linked per component using `document::Link`
- Routes defined as enums with `#[derive(Routable)]`
- Server functions use `#[server(FunctionName)]` macro
- File operations happen server-side, UI rendering client-side

## CSS Performance Guidelines
- Prefer `transform` and `opacity` for animations (GPU accelerated)
- Use `@media (prefers-reduced-motion: reduce)` for accessibility
- Avoid complex moving backgrounds that cause repaints
- Remove `!important` declarations where possible
- Use CSS custom properties (variables) for consistent theming
- Implement smooth transitions with reasonable durations (0.3s-0.6s)

## CSS Theme Variables
```css
/* Dark Mode (Default) */
--retro-green: #00ff41    /* Primary terminal green */
--retro-amber: #ffb000    /* Warning/accent color */
--retro-cyan: #00ffff     /* Link color */
--retro-purple: #ff00ff   /* Error color */
--retro-dark-bg: #000000  /* Main background */
--retro-light-bg: #1a1a1a /* Card backgrounds */

/* Light Mode */
--retro-green: #008000    /* Darker green for readability */
--retro-amber: #cc6600    /* Darker amber */
--retro-cyan: #006666     /* Darker cyan */
--retro-dark-bg: #f0f0f0  /* Light background */
--retro-light-bg: #ffffff /* White cards */
```

## Directory Structure
```
/blog/           - Blog post markdown files
/projects/       - Project markdown files  
/assets/         - Static assets (CSS, images)
/src/
  /components/   - Reusable UI components
  /views/        - Page-level components
```

## Adding New Content

### Blog Posts
1. Create a new `.md` file in the `blog/` directory
2. The filename becomes the blog post ID (e.g., `hello.md` → `/blog/hello`)
3. Blog posts support full Markdown syntax including tables, code blocks, and lists

### Projects  
1. Create a new `.md` file in the `projects/` directory
2. The filename becomes the project ID (e.g., `my-project.md` → `/projects/my-project`)
3. Projects support full Markdown syntax

### Assets
- Assets can be referenced relatively or absolutely
- Use the `asset!()` macro for CSS and static files

## Future Enhancements
- [ ] KaTeX integration for LaTeX math rendering
- [ ] Syntax highlighting for code blocks
- [ ] Search functionality across blog and projects
- [ ] RSS feed generation
- [ ] Comment system
- [ ] Matrix rain animation background (performance optimized)
- [ ] Terminal typing animation effects (smooth transitions)
- [ ] Tags/categories for blog posts and projects
- [ ] Date metadata for posts
- [ ] Image optimization and lazy loading
- [ ] Progressive Web App (PWA) features