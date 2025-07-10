use crate::components::ProjectList;
use dioxus::prelude::*;

#[component]
pub fn Projects() -> Element {
    rsx! {
        div { class: "content-section",
            div { class: "retro-terminal",
                h1 { "PROJECTS.DIR" }
                p { class: "section-description",
                    "> Listing available projects and blog posts..."
                }
                ProjectList {}
            }
        }
    }
}
