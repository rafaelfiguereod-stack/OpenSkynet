//! Scroll utilities for the TUI.

use crate::app::App;

/// Scroll up by a specified amount (show older content).
pub fn scroll_up(app: &mut App, amount: u16) {
    app.scroll.offset = app.scroll.offset.saturating_add(amount);
    app.scroll.auto_scroll = false;
}

/// Scroll down by a specified amount (show newer content).
pub fn scroll_down(app: &mut App, amount: u16) {
    app.scroll.offset = app.scroll.offset.saturating_sub(amount);
    app.scroll.auto_scroll = false;
}
