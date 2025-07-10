use dioxus::prelude::*;

#[derive(Props, Clone, PartialEq)]
pub struct WindowProps {
    pub id: String,
    pub title: String,
    pub position: (i32, i32),
    pub size: (u32, u32),
    pub is_active: bool,
    pub is_minimized: bool,
    pub is_maximized: bool,
    pub z_index: i32,
    pub on_close: EventHandler<String>,
    pub on_minimize: EventHandler<String>,
    pub on_maximize: EventHandler<String>,
    pub on_focus: EventHandler<String>,
    pub children: Element,
}

#[component]
pub fn Window(props: WindowProps) -> Element {
    let window_id = props.id.clone();

    let window_id_clone = window_id.clone();
    let window_id_clone2 = window_id.clone();
    let window_id_clone3 = window_id.clone();
    let window_id_clone4 = window_id.clone();
    let active_class = if props.is_active { "active" } else { "" };
    let display_style = if props.is_minimized { "none" } else { "block" };

    rsx! {
        div {
            class: "window {active_class}",
            style: "
                left: {props.position.0}px;
                top: {props.position.1}px;
                width: {props.size.0}px;
                height: {props.size.1}px;
                z-index: {props.z_index};
                display: {display_style};
            ",
            onclick: move |_| {
                props.on_focus.call(window_id_clone.clone());
            },

            div {
                class: "window-title-bar",

                div {
                    class: "window-controls",

                    button {
                        class: "window-control close",
                        onclick: move |_| {
                            props.on_close.call(window_id_clone2.clone());
                        },
                        "×"
                    }

                    button {
                        class: "window-control minimize",
                        onclick: move |_| {
                            props.on_minimize.call(window_id_clone3.clone());
                        },
                        "−"
                    }

                    button {
                        class: "window-control maximize",
                        onclick: move |_| {
                            props.on_maximize.call(window_id_clone4.clone());
                        },
                        "□"
                    }
                }

                div {
                    class: "window-title",
                    "{props.title}"
                }
            }

            div {
                class: "window-content",
                {props.children}
            }
        }
    }
}

#[derive(Props, Clone, PartialEq)]
pub struct WindowContentProps {
    pub children: Element,
}

#[component]
pub fn WindowContent(props: WindowContentProps) -> Element {
    rsx! {
        div {
            class: "window-content-inner",
            {props.children}
        }
    }
}

// Specialized window components for different content types
#[component]
pub fn AboutWindow() -> Element {
    rsx! {
        WindowContent {
            div {
                class: "about-content",
                h1 { "Ashesh Kaji" }
                p { class: "subtitle", "AI Engineer & Machine Learning Specialist" }

                div {
                    class: "content-section",
                    h2 { "About" }
                    p {
                        "Passionate AI engineer with expertise in machine learning, deep learning, and neural network architecture. "
                        "Focused on building intelligent systems that solve real-world problems through innovative data science approaches."
                    }
                }

                div {
                    class: "content-section",
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
                }

                div {
                    class: "content-section",
                    h2 { "Current Focus" }
                    p {
                        "Developing cutting-edge AI solutions with emphasis on scalability, performance, and ethical AI practices. "
                        "Always exploring the latest advancements in artificial intelligence and machine learning."
                    }
                }

                div {
                    class: "content-section",
                    h2 { "Education & Research" }
                    p { "Continuously learning and contributing to the AI community through research, experimentation, and knowledge sharing." }
                }
            }
        }
    }
}

#[component]
pub fn ContactWindow() -> Element {
    rsx! {
        WindowContent {
            div {
                class: "contact-content",
                h1 { "Get in Touch" }
                p { "Let's connect and discuss AI, machine learning, and innovative technology solutions." }

                div {
                    class: "contact-methods",
                    div {
                        class: "contact-item",
                        h3 { "Email" }
                        a {
                            href: "mailto:ashesh8500@gmail.com",
                            "ashesh8500@gmail.com"
                        }
                    }

                    div {
                        class: "contact-item",
                        h3 { "LinkedIn" }
                        a {
                            href: "https://linkedin.com/in/asheshkaji",
                            target: "_blank",
                            "linkedin.com/in/asheshkaji"
                        }
                    }

                    div {
                        class: "contact-item",
                        h3 { "GitHub" }
                        a {
                            href: "https://github.com/ashesh8500",
                            target: "_blank",
                            "github.com/ashesh8500"
                        }
                    }
                }

                div {
                    class: "content-section",
                    h2 { "Areas of Interest" }
                    p { "I'm always interested in discussing:" }
                    ul {
                        li { "AI/ML project collaborations" }
                        li { "Neural network architecture innovations" }
                        li { "Data science and analytics" }
                        li { "MLOps and production ML systems" }
                        li { "Ethical AI and responsible ML practices" }
                        li { "Technical mentoring and knowledge sharing" }
                    }
                }
            }
        }
    }
}

#[derive(Props, Clone, PartialEq)]
pub struct FolderWindowProps {
    pub folder_name: String,
    pub items: Vec<FolderItem>,
    pub on_item_click: EventHandler<String>,
}

#[derive(Clone, PartialEq)]
pub struct FolderItem {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub item_type: String,
}

#[component]
pub fn FolderWindow(props: FolderWindowProps) -> Element {
    let items = props.items.clone();

    rsx! {
        WindowContent {
            div {
                class: "folder-content",
                h1 { "{props.folder_name}" }

                div {
                    class: "folder-items",
                    {items.iter().map(|item| {
                        let item_id = item.id.clone();
                        rsx! {
                            div {
                                key: "{item.id}",
                                class: "folder-item",
                                onclick: move |_| {
                                    props.on_item_click.call(item_id.clone());
                                },

                                div {
                                    class: "folder-item-icon {item.icon}",
                                }

                                div {
                                    class: "folder-item-name",
                                    "{item.name}"
                                }
                            }
                        }
                    })}
                }
            }
        }
    }
}

// Loading component for async content
#[component]
pub fn LoadingWindow() -> Element {
    rsx! {
        WindowContent {
            div {
                class: "loading-content",
                div {
                    class: "loading-spinner",
                    "Loading..."
                }
            }
        }
    }
}

// Error component for failed content
#[derive(Props, Clone, PartialEq)]
pub struct ErrorWindowProps {
    pub error_message: String,
}

#[component]
pub fn ErrorWindow(props: ErrorWindowProps) -> Element {
    rsx! {
        WindowContent {
            div {
                class: "error-content",
                h1 { "Error" }
                p { "{props.error_message}" }
                button {
                    class: "retry-button",
                    onclick: move |_| {
                        // TODO: Implement retry logic
                    },
                    "Retry"
                }
            }
        }
    }
}
