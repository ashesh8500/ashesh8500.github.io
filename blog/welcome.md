# Welcome to My Retro Computing Blog

Welcome to my personal website! This is a demonstration of the **retro computing themed** blog system with markdown support.

## Features

This blog system includes:

- 🖥️ **Retro terminal aesthetics** with CRT-style effects
- 📝 **Markdown rendering** with syntax highlighting
- 🎨 **Custom cursor effects** for that authentic retro feel
- ⚡ **Dioxus framework** for blazing fast performance
- 📱 **Responsive design** that works on all devices

## Technical Stack

The website is built using:

```rust
// Main application structure
use dioxus::prelude::*;
use dioxus_router::prelude::*;

#[component]
fn App() -> Element {
    rsx! {
        Router::<Route> {}
    }
}
```

### Key Technologies

1. **Dioxus** - Modern Rust framework for building web applications
2. **Pulldown-cmark** - Markdown parsing and rendering
3. **CSS Animations** - For the retro computing effects
4. **Responsive Design** - Mobile-first approach

## Code Examples

Here's how the blog markdown rendering works:

```rust
async fn load_blog_post(id: &str) -> Result<String, String> {
    let file_path = format!("projects/{}.md", id);
    
    match fs::read_to_string(&file_path) {
        Ok(markdown_content) => {
            let mut options = Options::empty();
            options.insert(Options::ENABLE_STRIKETHROUGH);
            options.insert(Options::ENABLE_TABLES);
            options.insert(Options::ENABLE_FOOTNOTES);
            
            let parser = Parser::new_ext(&markdown_content, options);
            let mut html_output = String::new();
            html::push_html(&mut html_output, parser);
            
            Ok(html_output)
        },
        Err(_) => Err(format!("Could not find blog post: {}", id))
    }
}
```

## Mathematical Expressions

While we don't have LaTeX support yet, we can still show mathematical concepts:

- **Fibonacci Sequence**: F(n) = F(n-1) + F(n-2)
- **Big O Notation**: O(n), O(log n), O(n²)
- **Binary Operations**: 1010₂ + 1100₂ = 10110₂

## Lists and Tables

### Programming Languages I Use

- **Rust** 🦀 - Systems programming and web development
- **Python** 🐍 - Data science and automation
- **JavaScript/TypeScript** - Frontend development
- **Go** - Backend services and CLI tools

### Project Timeline

| Year | Project | Technology |
|------|---------|------------|
| 2024 | Personal Website | Rust + Dioxus |
| 2023 | Data Pipeline | Python + Apache Airflow |
| 2022 | API Gateway | Go + Gin |
| 2021 | React Dashboard | TypeScript + React |

## Blockquotes

> "The best way to predict the future is to invent it." - Alan Kay

This quote perfectly captures the spirit of innovation that drives modern computing.

## Next Steps

In future updates, I plan to add:

- [ ] LaTeX mathematical equation support
- [ ] Syntax highlighting for code blocks
- [ ] Comment system
- [ ] RSS feed generation
- [ ] Search functionality
- [ ] Dark/light theme toggle (though retro green is pretty cool!)

---

Thanks for visiting my retro-themed website! Feel free to explore the other sections and check out my projects.

*Built with ❤️ and lots of ☕ using Rust and Dioxus*