use dioxus::prelude::*;
use std::collections::HashMap;
use wasm_bindgen::JsValue;
use web_sys::wasm_bindgen::JsCast;

// Desktop state management
#[derive(Clone, PartialEq)]
pub struct DesktopState {
    pub windows: HashMap<String, WindowState>,
    pub window_order: Vec<String>,
    pub active_window: Option<String>,
    pub desktop_items: Vec<DesktopItem>,
    pub next_window_id: usize,
}

#[derive(Clone, PartialEq)]
pub struct WindowState {
    pub id: String,
    pub title: String,
    pub content: WindowContent,
    pub position: (i32, i32),
    pub size: (u32, u32),
    pub is_minimized: bool,
    pub is_maximized: bool,
    pub z_index: i32,
    pub is_dragging: bool,
    pub drag_offset: (i32, i32),
}

#[derive(Clone, PartialEq)]
pub enum WindowContent {
    Blog(String),
    Project(String),
    About,
    Contact,
    BlogList,
    ProjectList,
}

#[derive(Clone, PartialEq)]
pub struct DesktopItem {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub position: (i32, i32),
    pub item_type: DesktopItemType,
}

#[derive(Clone, PartialEq)]
pub enum DesktopItemType {
    Folder(String),
    Document(String),
    Application(String),
    Link(String),
}

impl Default for DesktopState {
    fn default() -> Self {
        Self {
            windows: HashMap::new(),
            window_order: Vec::new(),
            active_window: None,
            desktop_items: vec![
                DesktopItem {
                    id: "projects".to_string(),
                    name: "Projects".to_string(),
                    icon: "folder".to_string(),
                    position: (50, 50),
                    item_type: DesktopItemType::Folder("projects".to_string()),
                },
                DesktopItem {
                    id: "blog".to_string(),
                    name: "Blog".to_string(),
                    icon: "folder".to_string(),
                    position: (50, 150),
                    item_type: DesktopItemType::Folder("blog".to_string()),
                },
                DesktopItem {
                    id: "about".to_string(),
                    name: "About Me".to_string(),
                    icon: "document".to_string(),
                    position: (50, 250),
                    item_type: DesktopItemType::Document("about".to_string()),
                },
                DesktopItem {
                    id: "github".to_string(),
                    name: "GitHub".to_string(),
                    icon: "link".to_string(),
                    position: (50, 350),
                    item_type: DesktopItemType::Link("https://github.com/ashesh8500".to_string()),
                },
                DesktopItem {
                    id: "linkedin".to_string(),
                    name: "LinkedIn".to_string(),
                    icon: "link".to_string(),
                    position: (50, 450),
                    item_type: DesktopItemType::Link(
                        "https://linkedin.com/in/asheshkaji".to_string(),
                    ),
                },
            ],
            next_window_id: 1,
        }
    }
}

#[component]
pub fn Desktop() -> Element {
    let mut desktop_state = use_signal(DesktopState::default);

    // Window management functions
    let mut open_window = move |content: WindowContent, title: String| {
        let mut state = desktop_state.write();
        let window_id = format!("window_{}", state.next_window_id);
        state.next_window_id += 1;

        let window = WindowState {
            id: window_id.clone(),
            title,
            content,
            position: (
                150 + (state.windows.len() as i32 * 30),
                100 + (state.windows.len() as i32 * 30),
            ),
            size: (600, 400),
            is_minimized: false,
            is_maximized: false,
            z_index: state.windows.len() as i32 + 100,
            is_dragging: false,
            drag_offset: (0, 0),
        };

        state.windows.insert(window_id.clone(), window);
        state.window_order.push(window_id.clone());
        state.active_window = Some(window_id);
    };

    let close_window = move |window_id: String| {
        let mut state = desktop_state.write();
        state.windows.remove(&window_id);
        state.window_order.retain(|id| id != &window_id);

        // Set new active window
        state.active_window = state.window_order.last().cloned();
    };

    let minimize_window = move |window_id: String| {
        let mut state = desktop_state.write();
        if let Some(window) = state.windows.get_mut(&window_id) {
            window.is_minimized = true;
        }
    };

    let maximize_window = move |window_id: String| {
        let mut state = desktop_state.write();
        if let Some(window) = state.windows.get_mut(&window_id) {
            window.is_maximized = !window.is_maximized;
            if window.is_maximized {
                window.position = (0, 0);
                window.size = (800, 600);
            } else {
                window.position = (150, 100);
                window.size = (600, 400);
            }
        }
    };

    let restore_window = move |window_id: String| {
        let mut state = desktop_state.write();
        if let Some(window) = state.windows.get_mut(&window_id) {
            window.is_minimized = false;
        }
    };

    let focus_window = move |window_id: String| {
        let mut state = desktop_state.write();
        let windows_len = state.windows.len();
        if let Some(window) = state.windows.get_mut(&window_id) {
            window.z_index = windows_len as i32 + 100;
            state.active_window = Some(window_id.clone());

            // Reorder window stack
            state.window_order.retain(|id| id != &window_id);
            state.window_order.push(window_id);
        }
    };

    let handle_desktop_item_click = move |item: DesktopItem| {
        match item.item_type {
            DesktopItemType::Folder(folder_type) => match folder_type.as_str() {
                "projects" => {
                    open_window(WindowContent::ProjectList, "Projects".to_string());
                }
                "blog" => {
                    open_window(WindowContent::BlogList, "Blog".to_string());
                }
                _ => {}
            },
            DesktopItemType::Document(doc_type) => match doc_type.as_str() {
                "about" => {
                    open_window(WindowContent::About, "About Me".to_string());
                }
                _ => {}
            },
            DesktopItemType::Link(url) => {
                // Open external link
                if let Some(window) = web_sys::window() {
                    let _ = window.open_with_url_and_target(&url, "_blank");
                }
            }
            _ => {}
        }
    };

    let desktop_items = desktop_state.read().desktop_items.clone();
    let windows = desktop_state.read().windows.clone();
    let active_window = desktop_state.read().active_window.clone();

    rsx! {
        div {
            class: "desktop-environment",

            // Desktop background and items
            div {
                class: "desktop-background",

                // Desktop icons (simplified for now)
                div {
                    class: "desktop-item",
                    style: "left: 50px; top: 50px;",
                    onclick: move |_| {
                        open_window(WindowContent::ProjectList, "Projects".to_string());
                    },

                    div {
                        class: "desktop-icon folder",
                    }

                    div {
                        class: "desktop-label",
                        "Projects"
                    }
                }

                div {
                    class: "desktop-item",
                    style: "left: 50px; top: 150px;",
                    onclick: move |_| {
                        open_window(WindowContent::BlogList, "Blog".to_string());
                    },

                    div {
                        class: "desktop-icon folder",
                    }

                    div {
                        class: "desktop-label",
                        "Blog"
                    }
                }

                div {
                    class: "desktop-item",
                    style: "left: 50px; top: 250px;",
                    onclick: move |_| {
                        open_window(WindowContent::About, "About Me".to_string());
                    },

                    div {
                        class: "desktop-icon document",
                    }

                    div {
                        class: "desktop-label",
                        "About Me"
                    }
                }

                div {
                    class: "desktop-item",
                    style: "left: 50px; top: 350px;",
                    onclick: move |_| {
                        if let Some(window) = web_sys::window() {
                            let _ = window.open_with_url_and_target("https://github.com/ashesh8500", "_blank");
                        }
                    },

                    div {
                        class: "desktop-icon link",
                    }

                    div {
                        class: "desktop-label",
                        "GitHub"
                    }
                }

                div {
                    class: "desktop-item",
                    style: "left: 50px; top: 450px;",
                    onclick: move |_| {
                        if let Some(window) = web_sys::window() {
                            let _ = window.open_with_url_and_target("https://linkedin.com/in/asheshkaji", "_blank");
                        }
                    },

                    div {
                        class: "desktop-icon link",
                    }

                    div {
                        class: "desktop-label",
                        "LinkedIn"
                    }
                }
            }

            // Windows container
            div {
                class: "windows-container",

                // Render all windows
                for (window_id, window) in windows.iter() {
                    {
                        let window_id_close = window_id.clone();
                        let window_id_minimize = window_id.clone();
                        let window_id_maximize = window_id.clone();
                        let window_id_focus = window_id.clone();
                        let is_active = active_window.as_ref() == Some(window_id);

                        rsx! {
                            div {
                                key: "{window_id}",
                                class: "window {if is_active { \"active\" } else { \"\" }}",
                                style: "
                                    left: {window.position.0}px;
                                    top: {window.position.1}px;
                                    width: {window.size.0}px;
                                    height: {window.size.1}px;
                                    z-index: {window.z_index};
                                    display: {if window.is_minimized { \"none\" } else { \"block\" }};
                                ",
                                onclick: move |_| {
                                    focus_window(window_id_focus.clone());
                                },

                                // Window title bar
                                div {
                                    class: "window-title-bar",
                                    style: "cursor: move;",

                                    // Window controls
                                    div {
                                        class: "window-controls",

                                        button {
                                            class: "window-control close",
                                            onclick: move |evt| {
                                                evt.stop_propagation();
                                                close_window(window_id_close.clone());
                                            },
                                            "×"
                                        }

                                        button {
                                            class: "window-control minimize",
                                            onclick: move |evt| {
                                                evt.stop_propagation();
                                                minimize_window(window_id_minimize.clone());
                                            },
                                            "−"
                                        }

                                        button {
                                            class: "window-control maximize",
                                            onclick: move |evt| {
                                                evt.stop_propagation();
                                                maximize_window(window_id_maximize.clone());
                                            },
                                            "□"
                                        }
                                    }

                                    // Window title
                                    div {
                                        class: "window-title",
                                        "{window.title}"
                                    }
                                }

                                // Window content
                                div {
                                    class: "window-content",
                                    {match &window.content {
                                        WindowContent::Blog(blog_id) => rsx! {
                                            div {
                                                class: "blog-content",
                                                h1 { "Blog Post: {blog_id}" }
                                                p { "Loading blog content..." }
                                            }
                                        },
                                        WindowContent::Project(project_id) => rsx! {
                                            div {
                                                class: "project-content",
                                                h1 { "Project: {project_id}" }
                                                p { "Loading project content..." }
                                            }
                                        },
                                        WindowContent::About => rsx! {
                                            div {
                                                class: "about-content",
                                                h1 { "Ashesh Kaji" }
                                                p { class: "subtitle", "AI Engineer & Machine Learning Specialist" }

                                                h2 { "About" }
                                                p { "Passionate AI engineer with expertise in machine learning, deep learning, and neural network architecture. Focused on building intelligent systems that solve real-world problems through innovative data science approaches." }

                                                h2 { "Core Expertise" }
                                                ul {
                                                    li { "Machine Learning & Deep Learning Frameworks" }
                                                    li { "Neural Network Architecture Design" }
                                                    li { "Natural Language Processing" }
                                                    li { "Computer Vision & Image Processing" }
                                                    li { "Data Pipeline Development" }
                                                    li { "MLOps & Model Deployment" }
                                                    li { "Python, TensorFlow, PyTorch, Scikit-learn" }
                                                    li { "Cloud ML Platforms (AWS, GCP, Azure)" }
                                                }

                                                h2 { "Current Focus" }
                                                p { "Developing cutting-edge AI solutions with emphasis on scalability, performance, and ethical AI practices. Always exploring the latest advancements in artificial intelligence and machine learning." }
                                            }
                                        },
                                        WindowContent::Contact => rsx! {
                                            div {
                                                class: "contact-content",
                                                h1 { "Get in Touch" }
                                                p { "Let's connect and discuss AI, machine learning, and innovative technology solutions." }

                                                div {
                                                    class: "contact-methods",
                                                    div {
                                                        class: "contact-item",
                                                        h3 { "Email" }
                                                        a { href: "mailto:ashesh8500@gmail.com", "ashesh8500@gmail.com" }
                                                    }
                                                    div {
                                                        class: "contact-item",
                                                        h3 { "LinkedIn" }
                                                        a { href: "https://linkedin.com/in/asheshkaji", target: "_blank", "linkedin.com/in/asheshkaji" }
                                                    }
                                                    div {
                                                        class: "contact-item",
                                                        h3 { "GitHub" }
                                                        a { href: "https://github.com/ashesh8500", target: "_blank", "github.com/ashesh8500" }
                                                    }
                                                }
                                            }
                                        },
                                        WindowContent::BlogList => rsx! {
                                            div {
                                                class: "blog-list-content",
                                                h1 { "Blog Posts" }
                                                p { "AI Engineering insights and technical articles." }

                                                div {
                                                    class: "folder-items",
                                                    div {
                                                        class: "folder-item",
                                                        onclick: move |_| {
                                                            open_window(WindowContent::Blog("ai-engineering".to_string()), "AI Engineering Best Practices".to_string());
                                                        },
                                                        div { class: "folder-item-icon markdown" }
                                                        div { class: "folder-item-name", "AI Engineering Best Practices" }
                                                    }
                                                    div {
                                                        class: "folder-item",
                                                        onclick: move |_| {
                                                            open_window(WindowContent::Blog("machine-learning".to_string()), "Machine Learning Pipeline".to_string());
                                                        },
                                                        div { class: "folder-item-icon markdown" }
                                                        div { class: "folder-item-name", "Machine Learning Pipeline" }
                                                    }
                                                    div {
                                                        class: "folder-item",
                                                        onclick: move |_| {
                                                            open_window(WindowContent::Blog("neural-networks".to_string()), "Neural Network Architecture".to_string());
                                                        },
                                                        div { class: "folder-item-icon markdown" }
                                                        div { class: "folder-item-name", "Neural Network Architecture" }
                                                    }
                                                }
                                            }
                                        },
                                        WindowContent::ProjectList => rsx! {
                                            div {
                                                class: "project-list-content",
                                                h1 { "Projects" }
                                                p { "AI and machine learning projects." }

                                                div {
                                                    class: "folder-items",
                                                    div {
                                                        class: "folder-item",
                                                        onclick: move |_| {
                                                            open_window(WindowContent::Project("ai-chatbot".to_string()), "AI Chatbot".to_string());
                                                        },
                                                        div { class: "folder-item-icon project" }
                                                        div { class: "folder-item-name", "AI Chatbot System" }
                                                    }
                                                    div {
                                                        class: "folder-item",
                                                        onclick: move |_| {
                                                            open_window(WindowContent::Project("ml-pipeline".to_string()), "ML Pipeline".to_string());
                                                        },
                                                        div { class: "folder-item-icon project" }
                                                        div { class: "folder-item-name", "ML Data Pipeline" }
                                                    }
                                                    div {
                                                        class: "folder-item",
                                                        onclick: move |_| {
                                                            open_window(WindowContent::Project("neural-net".to_string()), "Neural Network".to_string());
                                                        },
                                                        div { class: "folder-item-icon project" }
                                                        div { class: "folder-item-name", "Custom Neural Network" }
                                                    }
                                                }
                                            }
                                        },
                                    }}
                                }
                            }
                        }
                    }
                }
            }

            // Desktop taskbar
            div {
                class: "desktop-taskbar",

                div {
                    class: "taskbar-windows",

                    // Show minimized windows
                    for (window_id, window) in windows.iter() {
                        if window.is_minimized {
                            {
                                let window_id_restore = window_id.clone();
                                rsx! {
                                    button {
                                        key: "{window_id}",
                                        class: "taskbar-window",
                                        onclick: move |_| {
                                            restore_window(window_id_restore.clone());
                                            focus_window(window_id_restore.clone());
                                        },
                                        "{window.title}"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
