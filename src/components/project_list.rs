use dioxus::prelude::*;

#[cfg(feature = "server")]
use std::fs;

#[component]
pub fn ProjectList() -> Element {
    let projects = use_resource(|| async { get_projects_server().await.unwrap_or_default() });

    rsx! {
        div { class: "projects-grid",
            match projects.read().as_ref() {
                Some(project_list) => rsx! {
                    for project in project_list {
                        div { class: "project-card",
                            h3 { "{project}" }
                            p { "Click to view this project" }
                            button {
                                class: "retro-button",
                                onclick: move |_| {
                                    // TODO: Open project in window
                                },
                                "View Project"
                            }
                        }
                    }
                },
                None => rsx! {
                    div { class: "loading retro-loading",
                        p { "Loading projects..." }
                    }
                }
            }
        }
    }
}

#[server(GetProjects)]
async fn get_projects_server() -> Result<Vec<String>, ServerFnError> {
    match fs::read_dir("projects") {
        Ok(entries) => {
            let projects = entries
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
            Ok(projects)
        }
        Err(e) => Err(ServerFnError::new(format!(
            "Failed to read projects directory: {}",
            e
        ))),
    }
}
