//! SearchModePicker modal key handling.

use crate::app::App;
use crossterm::event::{KeyCode, KeyModifiers};

pub const SEARCH_MODES: &[&str] = &["auto", "simple", "advanced"];

/// Handle SearchModePicker modal key input.
pub async fn handle_search_mode_picker(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    match key.code {
        KeyCode::Esc => {
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.active = None;
            true
        }
        KeyCode::Up | KeyCode::Char('k') => {
            if app.modals.search_mode_picker_selected > 0 {
                app.modals.search_mode_picker_selected -= 1;
            }
            true
        }
        KeyCode::Down | KeyCode::Char('j') => {
            if app.modals.search_mode_picker_selected < SEARCH_MODES.len() - 1 {
                app.modals.search_mode_picker_selected += 1;
            }
            true
        }
        KeyCode::Enter => {
            if let Some(mode) = SEARCH_MODES.get(app.modals.search_mode_picker_selected) {
                let old = app.agent.search_mode.clone();
                app.agent.search_mode = mode.to_string();
                if old != app.agent.search_mode {
                    // Persist
                    let config = crate::config::TuiConfig::load();
                    let mut config = config;
                    config.search_mode = app.agent.search_mode.clone();
                    if let Err(e) = config.save() {
                        app.add_error_message(format!("Failed to save: {}", e));
                    }
                    app.add_system_message(format!("Search mode: {} → {}", old, mode));
                }
            }
            app.modals.active = None;
            true
        }
        _ => false,
    }
}
