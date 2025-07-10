use dioxus::prelude::*;
use pulldown_cmark::{html, Parser};
use std::fs;

#[component]
pub fn ProjectDetail(project_path: String) -> Element {
    let path = format!("projects/{}", project_path);
    let markdown =
        fs::read_to_string(&path).unwrap_or_else(|_| String::from("No such project found"));
    let parser = Parser::new(&markdown);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);

    rsx! {
        div{
            h3 {"{project_path}"}
        }
        div {
            class: "project-detail",
            dangerous_inner_html: "{html_output}",
        }
    }
}
