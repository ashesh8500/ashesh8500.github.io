use eframe::egui;
use pulldown_cmark::{Parser, Event, Tag, CodeBlockKind};
use std::collections::HashMap;

#[cfg(not(target_arch = "wasm32"))]
use std::fs;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

// Embedded content for web version
#[cfg(target_arch = "wasm32")]
const BLOG_HELLO: &str = include_str!("../blog/hello.md");
#[cfg(target_arch = "wasm32")]
const BLOG_WELCOME: &str = include_str!("../blog/welcome.md");
#[cfg(target_arch = "wasm32")]
const BLOG_AI_JOURNEY: &str = include_str!("../blog/ai-journey.md");
#[cfg(target_arch = "wasm32")]
const PROJECT_PERSONAL_WEBSITE: &str = include_str!("../projects/personal-website.md");
#[cfg(target_arch = "wasm32")]
const PROJECT_RUST_DESKTOP_APP: &str = include_str!("../projects/rust-desktop-app.md");

#[cfg(not(target_arch = "wasm32"))]
fn main() -> Result<(), eframe::Error> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1200.0, 800.0])
            .with_title("Ashesh Kaji - AI Engineer")
            .with_icon(
                eframe::icon_data::from_png_bytes(&include_bytes!("../assets/favicon.ico")[..])
                    .unwrap_or_default(),
            ),
        ..Default::default()
    };

    eframe::run_native(
        "Personal Website",
        options,
        Box::new(|_cc| Ok(Box::new(PersonalWebApp::default()))),
    )
}

// When compiling for web
#[cfg(target_arch = "wasm32")]
fn main() {
    // Redirect `log` message to `console.log` and friends:
    eframe::WebLogger::init(log::LevelFilter::Debug).ok();

    let web_options = eframe::WebOptions::default();

    wasm_bindgen_futures::spawn_local(async {
        let document = web_sys::window()
            .expect("No global `window` exists")
            .document()
            .expect("Should have a document on window");
        
        let canvas = document
            .get_element_by_id("the_canvas_id")
            .expect("Failed to find the_canvas_id")
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .expect("the_canvas_id was not a HtmlCanvasElement");

        eframe::WebRunner::new()
            .start(
                canvas,
                web_options,
                Box::new(|_cc| Ok(Box::new(PersonalWebApp::default()))),
            )
            .await
            .expect("failed to start eframe");
    });
}

#[derive(Default)]
struct PersonalWebApp {
    windows: HashMap<String, WindowState>,
    next_window_id: usize,
    desktop_items: Vec<DesktopItem>,
}

#[derive(Clone)]
struct WindowState {
    id: String,
    title: String,
    content: WindowContent,
    is_open: bool,
    position: Option<egui::Pos2>,
    size: Option<egui::Vec2>,
}

#[derive(Clone)]
enum WindowContent {
    About,
    BlogList,
    ProjectList,
    Blog(String),
    Project(String),
}

#[derive(Clone)]
struct DesktopItem {
    name: String,
    icon: &'static str,
    position: egui::Pos2,
    item_type: DesktopItemType,
}

#[derive(Clone)]
enum DesktopItemType {
    Folder(String),
    Document(String),
    Link(String),
}

fn render_markdown(ui: &mut egui::Ui, markdown: &str) {
    let parser = Parser::new(markdown);
    let mut current_heading_level = 0;
    let mut in_code_block = false;
    let mut in_table = false;
    let mut table_headers: Vec<String> = Vec::new();
    let mut table_row: Vec<String> = Vec::new();
    let mut table_rows: Vec<Vec<String>> = Vec::new();
    let mut text_buffer = String::new();
    
    for event in parser {
        match event {
            Event::Start(tag) => {
                match tag {
                    Tag::Heading(level, _, _) => {
                        current_heading_level = level as u32;
                    }
                    Tag::Paragraph => {
                        text_buffer.clear();
                    }
                    Tag::CodeBlock(CodeBlockKind::Fenced(lang)) => {
                        ui.separator();
                        ui.add_space(5.0);
                        ui.with_layout(egui::Layout::left_to_right(egui::Align::TOP), |ui| {
                            ui.label(egui::RichText::new(format!("```{}", lang)).monospace().color(egui::Color32::DARK_GRAY));
                        });
                        in_code_block = true;
                    }
                    Tag::CodeBlock(CodeBlockKind::Indented) => {
                        ui.separator();
                        ui.add_space(5.0);
                        ui.with_layout(egui::Layout::left_to_right(egui::Align::TOP), |ui| {
                            ui.label(egui::RichText::new("```").monospace().color(egui::Color32::DARK_GRAY));
                        });
                        in_code_block = true;
                    }
                    Tag::Table(_) => {
                        in_table = true;
                        table_headers.clear();
                        table_rows.clear();
                    }
                    Tag::TableHead => {
                        table_headers.clear();
                    }
                    Tag::TableRow => {
                        table_row.clear();
                    }
                    Tag::TableCell => {
                        text_buffer.clear();
                    }
                    Tag::List(_) => {
                        ui.add_space(5.0);
                    }
                    Tag::Item => {
                        text_buffer.clear();
                    }
                    _ => {}
                }
            }
            Event::Text(text) => {
                let text_str = text.to_string();
                
                // Check for LaTeX math expressions
                if text_str.contains("$") {
                    render_text_with_math(ui, &text_str, in_code_block, current_heading_level);
                    if current_heading_level > 0 {
                        current_heading_level = 0;
                    }
                } else if in_code_block {
                    ui.with_layout(egui::Layout::left_to_right(egui::Align::TOP), |ui| {
                        ui.label(egui::RichText::new(text_str).monospace().background_color(egui::Color32::from_rgb(240, 240, 240)));
                    });
                } else if current_heading_level > 0 {
                    match current_heading_level {
                        1 => ui.heading(egui::RichText::new(text_str).size(28.0)),
                        2 => ui.heading(egui::RichText::new(text_str).size(22.0)),
                        3 => ui.heading(egui::RichText::new(text_str).size(18.0)),
                        _ => ui.label(egui::RichText::new(text_str).strong()),
                    };
                    current_heading_level = 0;
                } else {
                    text_buffer.push_str(&text_str);
                }
            }
            Event::Code(text) => {
                ui.label(egui::RichText::new(text.to_string()).monospace().background_color(egui::Color32::from_rgb(240, 240, 240)));
            }
            Event::End(tag) => {
                match tag {
                    Tag::CodeBlock(_) => {
                        ui.with_layout(egui::Layout::left_to_right(egui::Align::TOP), |ui| {
                            ui.label(egui::RichText::new("```").monospace().color(egui::Color32::DARK_GRAY));
                        });
                        ui.separator();
                        ui.add_space(5.0);
                        in_code_block = false;
                    }
                    Tag::Paragraph => {
                        if !text_buffer.is_empty() {
                            if text_buffer.contains("$") {
                                render_text_with_math(ui, &text_buffer, false, 0);
                            } else {
                                ui.label(text_buffer.clone());
                            }
                            text_buffer.clear();
                        }
                        ui.add_space(8.0);
                    }
                    Tag::Heading(_, _, _) => {
                        ui.add_space(5.0);
                        ui.separator();
                        ui.add_space(5.0);
                    }
                    Tag::TableCell => {
                        if in_table {
                            table_row.push(text_buffer.clone());
                            text_buffer.clear();
                        }
                    }
                    Tag::TableRow => {
                        if in_table {
                            if table_headers.is_empty() {
                                table_headers = table_row.clone();
                            } else {
                                table_rows.push(table_row.clone());
                            }
                            table_row.clear();
                        }
                    }
                    Tag::Table(_) => {
                        if in_table {
                            render_table(ui, &table_headers, &table_rows);
                            in_table = false;
                        }
                    }
                    Tag::Item => {
                        if !text_buffer.is_empty() {
                            ui.horizontal(|ui| {
                                ui.label("•");
                                ui.label(text_buffer.clone());
                            });
                            text_buffer.clear();
                        }
                    }
                    Tag::List(_) => {
                        ui.add_space(5.0);
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
    
    // Handle any remaining text
    if !text_buffer.is_empty() {
        if text_buffer.contains("$") {
            render_text_with_math(ui, &text_buffer, false, 0);
        } else {
            ui.label(text_buffer);
        }
    }
}

fn render_text_with_math(ui: &mut egui::Ui, text: &str, in_code_block: bool, heading_level: u32) {
    if in_code_block {
        ui.label(egui::RichText::new(text).monospace());
        return;
    }
    
    // Simple LaTeX math rendering - split by $ signs
    let parts: Vec<&str> = text.split('$').collect();
    if parts.len() == 1 {
        // No math, render normally
        if heading_level > 0 {
            match heading_level {
                1 => ui.heading(egui::RichText::new(text).size(28.0)),
                2 => ui.heading(egui::RichText::new(text).size(22.0)),
                3 => ui.heading(egui::RichText::new(text).size(18.0)),
                _ => ui.label(egui::RichText::new(text).strong()),
            };
        } else {
            ui.label(text);
        }
        return;
    }
    
    ui.horizontal_wrapped(|ui| {
        for (i, part) in parts.iter().enumerate() {
            if i % 2 == 0 {
                // Regular text
                if !part.is_empty() {
                    ui.label(*part);
                }
            } else {
                // Math expression - render with special formatting
                if !part.is_empty() {
                    ui.label(egui::RichText::new(format!("𝒇({})", part)).italics().color(egui::Color32::from_rgb(100, 50, 150)));
                }
            }
        }
    });
}

fn render_table(ui: &mut egui::Ui, headers: &[String], rows: &[Vec<String>]) {
    ui.add_space(10.0);
    
    egui::Grid::new("markdown_table")
        .striped(true)
        .show(ui, |ui| {
            // Headers
            for header in headers {
                ui.label(egui::RichText::new(header).strong());
            }
            ui.end_row();
            
            // Rows
            for row in rows {
                for cell in row {
                    ui.label(cell);
                }
                ui.end_row();
            }
        });
    
    ui.add_space(10.0);
}

impl PersonalWebApp {
    fn draw_welcome_wallpaper(&self, ui: &mut egui::Ui, rect: egui::Rect) {
        // Welcome message in center
        let center_x = rect.center().x;
        let center_y = rect.center().y - 100.0;
        
        // Semi-transparent background for text
        let text_bg = egui::Rect::from_center_size(
            egui::pos2(center_x, center_y),
            egui::vec2(500.0, 200.0),
        );
        ui.painter().rect_filled(
            text_bg,
            12.0,
            egui::Color32::from_rgba_unmultiplied(255, 255, 255, 220),
        );
        
        // Welcome title
        ui.painter().text(
            egui::pos2(center_x, center_y - 60.0),
            egui::Align2::CENTER_CENTER,
            "Welcome to Ashesh's Portfolio",
            egui::FontId::proportional(32.0),
            egui::Color32::from_rgb(40, 40, 40),
        );
        
        // Subtitle
        ui.painter().text(
            egui::pos2(center_x, center_y - 20.0),
            egui::Align2::CENTER_CENTER,
            "🤖 AI Engineer & Machine Learning Specialist",
            egui::FontId::proportional(18.0),
            egui::Color32::from_rgb(60, 60, 60),
        );
        
        // Instructions
        ui.painter().text(
            egui::pos2(center_x, center_y + 20.0),
            egui::Align2::CENTER_CENTER,
            "Click on desktop icons to explore projects, blogs, and more!",
            egui::FontId::proportional(14.0),
            egui::Color32::from_rgb(80, 80, 80),
        );
        
        // Tech stack
        ui.painter().text(
            egui::pos2(center_x, center_y + 50.0),
            egui::Align2::CENTER_CENTER,
            "Built with Rust 🦀 • WebAssembly • egui",
            egui::FontId::proportional(12.0),
            egui::Color32::from_rgb(100, 100, 100),
        );
    }

    fn draw_dock(&self, ui: &mut egui::Ui, rect: egui::Rect) {
        let dock_height = 70.0;
        let dock_width = 400.0;
        let dock_rect = egui::Rect::from_center_size(
            egui::pos2(rect.center().x, rect.bottom() - dock_height / 2.0 - 10.0),
            egui::vec2(dock_width, dock_height),
        );
        
        // Dock background
        ui.painter().rect_filled(
            dock_rect,
            15.0,
            egui::Color32::from_rgba_unmultiplied(240, 240, 240, 200),
        );
        
        // Dock items
        let dock_items = vec![
            ("📁", "Projects"),
            ("📝", "Blog"),
            ("👤", "About"),
            ("🔗", "GitHub"),
            ("💼", "LinkedIn"),
        ];
        
        let item_size = 50.0;
        let spacing = (dock_width - (dock_items.len() as f32 * item_size)) / (dock_items.len() + 1) as f32;
        
        for (i, (icon, _label)) in dock_items.iter().enumerate() {
            let item_x = dock_rect.left() + spacing + (i as f32 * (item_size + spacing));
            let item_center = egui::pos2(item_x + item_size / 2.0, dock_rect.center().y);
            let item_rect = egui::Rect::from_center_size(item_center, egui::vec2(item_size, item_size));
            
            // Item background
            ui.painter().rect_filled(
                item_rect,
                8.0,
                egui::Color32::from_rgba_unmultiplied(255, 255, 255, 150),
            );
            
            // Icon
            ui.painter().text(
                item_center,
                egui::Align2::CENTER_CENTER,
                *icon,
                egui::FontId::proportional(24.0),
                egui::Color32::BLACK,
            );
        }
    }

    fn create_window(&mut self, content: WindowContent, title: String) {
        let window_id = format!("window_{}", self.next_window_id);
        self.next_window_id += 1;

        let window = WindowState {
            id: window_id.clone(),
            title,
            content,
            is_open: true,
            position: Some(egui::pos2(
                100.0 + (self.windows.len() as f32 * 30.0),
                100.0 + (self.windows.len() as f32 * 30.0),
            )),
            size: Some(egui::vec2(600.0, 400.0)),
        };

        self.windows.insert(window_id, window);
    }

    fn setup_desktop_items(&mut self) {
        self.desktop_items = vec![
            DesktopItem {
                name: "Projects".to_string(),
                icon: "📁",
                position: egui::pos2(50.0, 50.0),
                item_type: DesktopItemType::Folder("projects".to_string()),
            },
            DesktopItem {
                name: "Blog".to_string(),
                icon: "📁",
                position: egui::pos2(50.0, 150.0),
                item_type: DesktopItemType::Folder("blog".to_string()),
            },
            DesktopItem {
                name: "About Me".to_string(),
                icon: "📄",
                position: egui::pos2(50.0, 250.0),
                item_type: DesktopItemType::Document("about".to_string()),
            },
            DesktopItem {
                name: "GitHub".to_string(),
                icon: "🔗",
                position: egui::pos2(50.0, 350.0),
                item_type: DesktopItemType::Link("https://github.com/ashesh8500".to_string()),
            },
            DesktopItem {
                name: "LinkedIn".to_string(),
                icon: "💼",
                position: egui::pos2(50.0, 450.0),
                item_type: DesktopItemType::Link("https://linkedin.com/in/asheshkaji".to_string()),
            },
        ];
    }
}

impl eframe::App for PersonalWebApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Setup desktop items if not already done
        if self.desktop_items.is_empty() {
            self.setup_desktop_items();
        }

        // Apply retro macOS styling
        ctx.set_style(retro_macos_style());

        // Desktop background
        egui::CentralPanel::default()
            .frame(egui::Frame::default().fill(egui::Color32::from_rgb(192, 192, 192)))
            .show(ctx, |ui| {
                let rect = ui.available_rect_before_wrap();
                
                // Draw gradient background
                let gradient_color_top = egui::Color32::from_rgb(140, 190, 240);
                let gradient_color_bottom = egui::Color32::from_rgb(92, 142, 192);
                
                for y in 0..rect.height() as i32 {
                    let progress = y as f32 / rect.height();
                    let color = egui::Color32::from_rgb(
                        (gradient_color_top.r() as f32 * (1.0 - progress) + gradient_color_bottom.r() as f32 * progress) as u8,
                        (gradient_color_top.g() as f32 * (1.0 - progress) + gradient_color_bottom.g() as f32 * progress) as u8,
                        (gradient_color_top.b() as f32 * (1.0 - progress) + gradient_color_bottom.b() as f32 * progress) as u8,
                    );
                    ui.painter().rect_filled(
                        egui::Rect::from_min_size(
                            egui::pos2(0.0, y as f32),
                            egui::vec2(rect.width(), 1.0),
                        ),
                        0.0,
                        color,
                    );
                }
                
                // Draw welcome wallpaper
                self.draw_welcome_wallpaper(ui, rect);
                
                // Draw dock
                self.draw_dock(ui, rect);

                // Desktop items
                for item in &self.desktop_items.clone() {
                    let item_rect =
                        egui::Rect::from_center_size(item.position, egui::vec2(64.0, 80.0));

                    let response = ui.allocate_rect(item_rect, egui::Sense::click());

                    if response.hovered() {
                        ui.painter().rect_filled(
                            item_rect,
                            4.0,
                            egui::Color32::from_rgba_unmultiplied(0, 102, 204, 25),
                        );
                    }

                    // Draw icon
                    ui.painter().text(
                        egui::pos2(item.position.x, item.position.y - 10.0),
                        egui::Align2::CENTER_CENTER,
                        item.icon,
                        egui::FontId::proportional(32.0),
                        egui::Color32::BLACK,
                    );

                    // Draw label
                    ui.painter().text(
                        egui::pos2(item.position.x, item.position.y + 25.0),
                        egui::Align2::CENTER_CENTER,
                        &item.name,
                        egui::FontId::proportional(11.0),
                        egui::Color32::BLACK,
                    );

                    if response.clicked() {
                        match &item.item_type {
                            DesktopItemType::Folder(folder_type) => match folder_type.as_str() {
                                "projects" => self.create_window(
                                    WindowContent::ProjectList,
                                    "Projects".to_string(),
                                ),
                                "blog" => {
                                    self.create_window(WindowContent::BlogList, "Blog".to_string())
                                }
                                _ => {}
                            },
                            DesktopItemType::Document(doc_type) => match doc_type.as_str() {
                                "about" => {
                                    self.create_window(WindowContent::About, "About Me".to_string())
                                }
                                _ => {}
                            },
                            DesktopItemType::Link(url) => {
                                #[cfg(not(target_arch = "wasm32"))]
                                {
                                    if let Err(e) = webbrowser::open(url) {
                                        eprintln!("Failed to open URL: {}", e);
                                    }
                                }
                                #[cfg(target_arch = "wasm32")]
                                {
                                    let _ = web_sys::window()
                                        .unwrap()
                                        .open_with_url_and_target(url, "_blank");
                                }
                            }
                        }
                    }
                }
            });

        // Render windows
        let window_ids: Vec<String> = self.windows.keys().cloned().collect();
        for window_id in window_ids {
            let mut window = self.windows.get(&window_id).unwrap().clone();

            if window.is_open {
                let mut window_open = true;

                egui::Window::new(&window.title)
                    .id(egui::Id::new(&window.id))
                    .open(&mut window_open)
                    .default_pos(window.position.unwrap_or(egui::pos2(200.0, 200.0)))
                    .default_size(window.size.unwrap_or(egui::vec2(600.0, 400.0)))
                    .resizable(true)
                    .collapsible(false)
                    .show(ctx, |ui| {
                        match &window.content {
                            WindowContent::About => {
                                ui.heading("Ashesh Kaji");
                                ui.label("AI Engineer & Machine Learning Specialist");
                                ui.separator();

                                ui.heading("About");
                                ui.label("Passionate AI engineer with expertise in machine learning, deep learning, and neural network architecture. Focused on building intelligent systems that solve real-world problems through innovative data science approaches.");

                                ui.heading("Core Expertise");
                                ui.label("• Machine Learning & Deep Learning Frameworks");
                                ui.label("• Neural Network Architecture Design");
                                ui.label("• Natural Language Processing");
                                ui.label("• Computer Vision & Image Processing");
                                ui.label("• Data Pipeline Development");
                                ui.label("• MLOps & Model Deployment");
                                ui.label("• Python, TensorFlow, PyTorch, Scikit-learn");
                                ui.label("• Cloud ML Platforms (AWS, GCP, Azure)");

                                ui.heading("Current Focus");
                                ui.label("Developing cutting-edge AI solutions with emphasis on scalability, performance, and ethical AI practices. Always exploring the latest advancements in artificial intelligence and machine learning.");
                            }


                            WindowContent::BlogList => {
                                ui.heading("Blog Posts");
                                ui.separator();
                                
                                #[cfg(not(target_arch = "wasm32"))]
                                {
                                    if let Ok(entries) = fs::read_dir("./blog") {
                                        for entry in entries.flatten() {
                                            let path = entry.path();
                                            if let Some(stem) = path.file_stem().and_then(|s| s.to_str())
                                            {
                                                if path.extension().and_then(|s| s.to_str())
                                                    == Some("md")
                                                {
                                                    let blog_id = stem.to_string();
                                                    let title = blog_id.replace('-', " ");
                                                    if ui.button(format!("📝 {}", title)).clicked() {
                                                        self.create_window(
                                                            WindowContent::Blog(blog_id.clone()),
                                                            title,
                                                        );
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        ui.label("Could not read blog directory.");
                                    }
                                }
                                
                                #[cfg(target_arch = "wasm32")]
                                {
                                    let blogs = vec![
                                        ("hello", "Hello World"),
                                        ("welcome", "Welcome"),
                                        ("ai-journey", "AI Journey"),
                                    ];
                                    
                                    for (blog_id, title) in blogs {
                                        if ui.button(format!("📝 {}", title)).clicked() {
                                            self.create_window(
                                                WindowContent::Blog(blog_id.to_string()),
                                                title.to_string(),
                                            );
                                        }
                                    }
                                }
                            }

                            WindowContent::ProjectList => {
                                ui.heading("Projects");
                                ui.separator();
                                
                                #[cfg(not(target_arch = "wasm32"))]
                                {
                                    if let Ok(entries) = fs::read_dir("./projects") {
                                        for entry in entries.flatten() {
                                            let path = entry.path();
                                            if let Some(stem) = path.file_stem().and_then(|s| s.to_str())
                                            {
                                                if path.extension().and_then(|s| s.to_str())
                                                    == Some("md")
                                                {
                                                    let project_id = stem.to_string();
                                                    let title = project_id.replace('-', " ");
                                                    if ui.button(format!("🤖 {}", title)).clicked() {
                                                        self.create_window(
                                                            WindowContent::Project(project_id.clone()),
                                                            title,
                                                        );
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        ui.label("Could not read projects directory.");
                                    }
                                }
                                
                                #[cfg(target_arch = "wasm32")]
                                {
                                    let projects = vec![
                                        ("personal-website", "Personal Website"),
                                        ("rust-desktop-app", "Rust Desktop App"),
                                    ];
                                    
                                    for (project_id, title) in projects {
                                        if ui.button(format!("🤖 {}", title)).clicked() {
                                            self.create_window(
                                                WindowContent::Project(project_id.to_string()),
                                                title.to_string(),
                                            );
                                        }
                                    }
                                }
                            }

                            WindowContent::Blog(blog_id) => {
                                egui::ScrollArea::vertical().show(ui, |ui| {
                                    #[cfg(not(target_arch = "wasm32"))]
                                    {
                                        let path = format!("./blog/{}.md", blog_id);
                                        match fs::read_to_string(&path) {
                                            Ok(content) => {
                                                render_markdown(ui, &content);
                                            }
                                            Err(e) => {
                                                ui.label(format!(
                                                    "Failed to load blog post: {}\nPath: {}",
                                                    e, path
                                                ));
                                            }
                                        }
                                    }
                                    
                                    #[cfg(target_arch = "wasm32")]
                                    {
                                        let content = match blog_id.as_str() {
                                            "hello" => BLOG_HELLO,
                                            "welcome" => BLOG_WELCOME,
                                            "ai-journey" => BLOG_AI_JOURNEY,
                                            _ => "Blog post not found.",
                                        };
                                        render_markdown(ui, content);
                                    }
                                });
                            }

                            WindowContent::Project(project_id) => {
                                egui::ScrollArea::vertical().show(ui, |ui| {
                                    #[cfg(not(target_arch = "wasm32"))]
                                    {
                                        let path = format!("./projects/{}.md", project_id);
                                        match fs::read_to_string(&path) {
                                            Ok(content) => {
                                                render_markdown(ui, &content);
                                            }
                                            Err(e) => {
                                                ui.label(format!(
                                                    "Failed to load project details: {}\nPath: {}",
                                                    e, path
                                                ));
                                            }
                                        }
                                    }
                                    
                                    #[cfg(target_arch = "wasm32")]
                                    {
                                        let content = match project_id.as_str() {
                                            "personal-website" => PROJECT_PERSONAL_WEBSITE,
                                            "rust-desktop-app" => PROJECT_RUST_DESKTOP_APP,
                                            _ => "Project not found.",
                                        };
                                        render_markdown(ui, content);
                                    }
                                });
                            }
                        }
                    });

                window.is_open = window_open;
                self.windows.insert(window_id, window);
            }
        }

        // Remove closed windows
        self.windows.retain(|_, window| window.is_open);
    }
}

fn retro_macos_style() -> egui::Style {
    let mut style = egui::Style::default();

    // Window styling
    style.visuals.window_fill = egui::Color32::WHITE;
    style.visuals.window_stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(128, 128, 128));
    style.visuals.window_shadow = egui::epaint::Shadow {
        offset: [2, 2],
        blur: 8,
        spread: 0,
        color: egui::Color32::from_black_alpha(100),
    };

    // Text styling
    style.visuals.override_text_color = Some(egui::Color32::BLACK);

    // Button styling
    style.visuals.widgets.inactive.bg_fill = egui::Color32::from_rgb(221, 221, 221);
    style.visuals.widgets.inactive.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(153, 153, 153));
    style.visuals.widgets.hovered.bg_fill = egui::Color32::from_rgb(238, 238, 238);
    style.visuals.widgets.active.bg_fill = egui::Color32::from_rgb(204, 204, 204);

    // Panel styling
    style.visuals.panel_fill = egui::Color32::from_rgb(192, 192, 192);

    style
}
