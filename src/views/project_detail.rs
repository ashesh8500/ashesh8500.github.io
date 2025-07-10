use dioxus::prelude::*;

#[cfg(feature = "server")]
use pulldown_cmark::{html, Options, Parser};
#[cfg(feature = "server")]
use std::fs;

const BLOG_CSS: Asset = asset!("/assets/styling/blog.css");

#[component]
pub fn ProjectDetail(id: String) -> Element {
    let id_clone = id.clone();
    let content = use_resource(move || {
        let id = id_clone.clone();
        async move { load_project_server(id).await }
    });

    rsx! {
        document::Link { rel: "stylesheet", href: BLOG_CSS }

        div { class: "blog-container retro-terminal",
            match content.read().as_ref() {
                Some(Ok(html_content)) => rsx! {
                    div {
                        class: "blog-content",
                        dangerous_inner_html: "{html_content}"
                    }
                },
                Some(Err(e)) => rsx! {
                    div { class: "error retro-error",
                        h2 { "404 - Project Not Found" }
                        p { "Error: {e}" }
                        p { "The requested project '{id}' does not exist." }
                    }
                },
                None => rsx! {
                    div { class: "loading retro-loading",
                        p { "Loading..." }
                        div { class: "loading-dots" }
                    }
                }
            }
        }
    }
}

#[server(LoadProject)]
async fn load_project_server(id: String) -> Result<String, ServerFnError> {
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
        }
        Err(_) => Err(ServerFnError::new(format!("Could not find project: {}", id))),
    }
}
