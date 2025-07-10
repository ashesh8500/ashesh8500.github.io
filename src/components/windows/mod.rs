// Windows components module
pub mod window;

// Re-export main components
pub use window::{
    AboutWindow, ContactWindow, ErrorWindow, FolderWindow, LoadingWindow, Window, WindowContent,
};

// Re-export types for external use
pub use window::{
    ErrorWindowProps, FolderItem, FolderWindowProps, WindowContentProps, WindowProps,
};
