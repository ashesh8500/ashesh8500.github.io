use crate::components::BlogList;
use dioxus::prelude::*;

#[component]
pub fn BlogIndex() -> Element {
    rsx! {
        div { class: "content-section",
            div { class: "retro-terminal",
                h1 { "BLOG.DIR" }
                p { class: "section-description",
                    "> Listing available blog posts..."
                }
                BlogList {}
            }
        }
    }
}
