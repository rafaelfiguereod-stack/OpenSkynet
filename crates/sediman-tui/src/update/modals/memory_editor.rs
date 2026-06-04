//! MemoryEditor modal key handling.

use crate::app::App;
use crossterm::event::{KeyCode, KeyModifiers};

/// Handle MemoryEditor modal key input.
pub async fn handle_memory_editor(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    match key.code {
        KeyCode::Esc | KeyCode::Char('q') => {
            app.modals.memory_editor_input.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.memory_editor_input.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Up => {
            if app.modals.memory_editor_index > 0 {
                app.modals.memory_editor_index -= 1;
            }
            true
        }
        KeyCode::Down => {
            if app.modals.memory_editor_index < app.modals.memory_entries.len().saturating_sub(1) {
                app.modals.memory_editor_index += 1;
            }
            true
        }
        KeyCode::Enter => {
            if !app.modals.memory_editor_input.is_empty() {
                let text = app.modals.memory_editor_input.clone();
                if let Err(e) = app.connection.bridge.memory_add("memory", &text).await {
                    tracing::warn!("Failed to add memory: {e}");
                }
                app.modals.memory_entries.push(("memory".to_string(), text));
                app.modals.memory_editor_input.clear();
            }
            true
        }
        KeyCode::Char('d') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            if let Some((target, content)) = app.modals.memory_entries.get(app.modals.memory_editor_index).cloned() {
                if let Err(e) = app.connection.bridge.memory_remove(&target, &content).await {
                    tracing::warn!("Failed to remove memory: {e}");
                }
                app.modals.memory_entries.remove(app.modals.memory_editor_index);
                if app.modals.memory_editor_index > 0 {
                    app.modals.memory_editor_index -= 1;
                }
            }
            true
        }
        KeyCode::Backspace => {
            app.modals.memory_editor_input.pop();
            true
        }
        KeyCode::Tab => {
            true
        }
        KeyCode::Char(c) => {
            app.modals.memory_editor_input.push(c);
            true
        }
        _ => false,
    }
}
