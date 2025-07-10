use dioxus::prelude::*;

#[component]
pub fn Footer() -> Element {
    rsx! {
        footer { class: "retro-footer",
            div { class: "footer-content",
                p { "© 2025 Ashesh Kaji" }
                div { class: "footer-links",
                    a { href: "https://github.com/ashesh8500", target: "_blank", "GitHub" }
                    a { href: "https://linkedin.com/in/asheshkaji", target: "_blank", "LinkedIn" }
                }
            }
        }
    }
}
