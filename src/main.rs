use dioxus::prelude::*;

use components::Desktop;

mod components;
mod views;

// Desktop-based application - no traditional routing needed

const FAVICON: Asset = asset!("/assets/favicon.ico");
const RESET_CSS: Asset = asset!("/assets/styling/reset.css");
const DESKTOP_CSS: Asset = asset!("/assets/styling/desktop.css");
const WINDOWS_CSS: Asset = asset!("/assets/styling/windows.css");

fn main() {
    dioxus::launch(App);
}

#[component]
fn App() -> Element {
    rsx! {
        document::Link { rel: "icon", href: FAVICON }
        document::Link { rel: "stylesheet", href: RESET_CSS }
        document::Link { rel: "stylesheet", href: DESKTOP_CSS }
        document::Link { rel: "stylesheet", href: WINDOWS_CSS }

        Desktop {}
    }
}
