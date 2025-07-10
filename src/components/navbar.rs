use dioxus::prelude::*;

const NAVBAR_CSS: Asset = asset!("/assets/styling/navbar.css");

#[component]
pub fn Navbar() -> Element {
    rsx! {
        document::Link { rel: "stylesheet", href: NAVBAR_CSS }

        div { class: "retro-navbar",
            div { class: "navbar-brand",
                span { "Ashesh Kaji" }
            }
            nav { class: "navbar-links",
                span { "Home" }
                span { "Blog" }
                span { "Projects" }
            }
        }
    }
}
