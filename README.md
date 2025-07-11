# Personal Web - Rust Web Portfolio

A retro-styled portfolio application built with Rust and egui, featuring a macOS-inspired interface with markdown blog and project support. Available as both a web app and desktop application.

## 🚀 Features

- **Web & Desktop**: Runs in browsers via WebAssembly or as a native desktop app
- **Retro macOS UI**: Classic desktop-style interface with windows and icons
- **Markdown Support**: Blog posts and project documentation with syntax highlighting
- **Window Management**: Multi-window interface with draggable, resizable windows
- **Interactive Desktop**: Click-able desktop items for navigation
- **Fast Performance**: Built with Rust for optimal speed and memory efficiency
- **GitHub Pages Ready**: Automated deployment to GitHub Pages

## 🌐 Live Demo

Visit the live web version at: **[Your GitHub Pages URL]**

## 🛠️ Tech Stack

- **Language**: Rust 🦀
- **GUI Framework**: egui + eframe
- **Web Target**: WebAssembly (WASM)
- **Markdown Parser**: pulldown-cmark
- **Build Tool**: Trunk
- **Deployment**: GitHub Actions + GitHub Pages
- **Platform**: Web browsers + Cross-platform desktop

## 📦 Quick Start

### Web Version (Recommended)
The easiest way to run this is to visit the live demo or deploy to GitHub Pages (instructions below).

### Local Development

#### Prerequisites
- Rust 1.70+ installed ([rustup.rs](https://rustup.rs/))
- For web development: [Trunk](https://trunkrs.dev/) (`cargo install trunk`)

#### Web Development
```bash
git clone <repository-url>
cd personal_web

# Add WebAssembly target
rustup target add wasm32-unknown-unknown

# Install and run with Trunk
cargo install trunk
trunk serve --open
```

#### Desktop Development
```bash
git clone <repository-url>
cd personal_web
cargo run --release
```

## 🎨 Interface

The application features a retro macOS desktop interface with:
- **Desktop Items**: Click on folders to open blogs and projects
- **About Me**: Personal information and expertise
- **Social Links**: Direct links to GitHub and LinkedIn
- **Window System**: Multiple windows with proper focus management

## 📁 Project Structure

```
personal_web/
├── src/
│   └── main.rs           # Main application code
├── blog/                 # Markdown blog posts
│   ├── hello.md
│   ├── ai-journey.md
│   └── welcome.md
├── projects/             # Project documentation
│   ├── personal-website.md
│   └── rust-desktop-app.md
├── assets/
│   └── favicon.ico       # Application icon
└── Cargo.toml           # Dependencies and metadata
```

## 📝 Adding Content

### Blog Posts
Create new `.md` files in the `blog/` directory. They will automatically appear in the blog list.

### Projects
Add project documentation as `.md` files in the `projects/` directory.

### Markdown Features Supported
- Headers (H1-H6)
- Paragraphs
- Code blocks with syntax highlighting
- Inline code
- Basic text formatting

## 🔧 Customization

The retro macOS style can be customized in the `retro_macos_style()` function:
- Window colors and shadows
- Text styling
- Button appearances
- Panel backgrounds

## 🚀 Deploying to GitHub Pages

### Automatic Deployment (Recommended)

1. **Fork or clone this repository** to your GitHub account
2. **Push to the main branch** - GitHub Actions will automatically build and deploy
3. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Source: "Deploy from a branch" 
   - Branch: `gh-pages` (this will be created automatically)
4. **Your site will be live** at `https://yourusername.github.io/repository-name/`

### Manual Setup

If you want to set up the deployment manually:

1. **Create the repository** on GitHub
2. **Add these secrets** to your repository (if needed):
   - Usually no secrets required for public repositories
3. **Push your code** to the main branch
4. **Check the Actions tab** to see the deployment progress
5. **Enable GitHub Pages** in repository settings pointing to the `gh-pages` branch

### Local Testing

Before deploying, test the web version locally:

```bash
# Install dependencies
rustup target add wasm32-unknown-unknown
cargo install trunk

# Build and serve locally
trunk serve --open

# Or build for production
trunk build --release
```

## 🛠️ Development

### Building for Different Targets

#### Web (WASM)
```bash
trunk build --release
```

#### Desktop 
```bash
cargo build --release
```

### Development Mode
```bash
# Web development with hot reload
trunk serve --open

# Desktop development
cargo run
```

## 📋 Dependencies

- `eframe`: GUI framework and window management
- `egui`: Immediate mode GUI library
- `pulldown-cmark`: Markdown parsing
- `serde`: Serialization framework
- `regex`: Regular expressions
- `webbrowser`: External link handling

## 🤝 Contributing

This is a personal portfolio project, but suggestions and improvements are welcome!

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Ashesh Kaji**
- AI Engineer & Machine Learning Specialist
- GitHub: [@ashesh8500](https://github.com/ashesh8500)
- LinkedIn: [asheshkaji](https://linkedin.com/in/asheshkaji)
- Email: ashesh8500@gmail.com

---

*Built with Rust 🦀 and passion for elegant desktop applications*