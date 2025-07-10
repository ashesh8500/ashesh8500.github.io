use dioxus::prelude::*;

#[cfg(feature = "server")]
use std::fs;

#[component]
pub fn BlogList() -> Element {
    let blogs = use_resource(|| async { get_blogs_server().await.unwrap_or_default() });

    rsx! {
        div { class: "projects-grid",
            match blogs.read().as_ref() {
                Some(blog_list) => rsx! {
                    for blog in blog_list {
                        div { class: "project-card",
                            h3 { "{blog}" }
                            p { "Click to view this blog post" }
                            button {
                                class: "retro-button",
                                onclick: move |_| {
                                    // TODO: Open blog in window
                                },
                                "Read Post"
                            }
                        }
                    }
                },
                None => rsx! {
                    div { class: "loading retro-loading",
                        p { "Loading blog posts..." }
                    }
                }
            }
        }
    }
}

#[server(GetBlogs)]
async fn get_blogs_server() -> Result<Vec<String>, ServerFnError> {
    match fs::read_dir("blog") {
        Ok(entries) => {
            let blogs = entries
                .filter_map(|entry| {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.extension()?.to_str()? == "md" {
                            let stem = path.file_stem()?.to_str()?.to_string();
                            Some(stem)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect::<Vec<String>>();
            Ok(blogs)
        }
        Err(e) => Err(ServerFnError::new(format!(
            "Failed to read blog directory: {}",
            e
        ))),
    }
}
