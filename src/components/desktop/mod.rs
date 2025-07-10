// Desktop components module
pub mod desktop;

// Re-export main components
pub use desktop::Desktop;

// Re-export types for external use
pub use desktop::{DesktopItem, DesktopItemType, DesktopState, WindowContent, WindowState};
