use dioxus::prelude::*;

#[component]
pub fn Hero() -> Element {
    rsx! {
        div { id: "hero", class: "retro-terminal",
            div { class: "hero-header",
                h1 { class: "glitch",
                    "ASHESH_KAJI.EXE"
                }
                p { class: "hero-subtitle",
                    "> Software Engineer & Digital Craftsman"
                }
                p { class: "hero-description",
                    "Welcome to my digital workspace. I build things with code."
                }
            }

            div { id: "links",
                a { href: "/projects", "📁 Projects.dir" }
                a { href: "/blog", "📝 Blog.md" }
                a { href: "https://github.com/ashesh8500", target: "_blank", "🔗 GitHub.link" }
                a { href: "https://linkedin.com/in/asheshkaji", target: "_blank", "💼 LinkedIn.url" }
                a { href: "mailto:ashesh8500@gmail.com", "📧 Contact.mail" }
            }

            div { class: "terminal-prompt",
                span { class: "prompt-symbol", "$ " }
                span { class: "prompt-text", "explore --interactive" }
                span { class: "cursor-blink", "█" }
            }
        }
    }
}
