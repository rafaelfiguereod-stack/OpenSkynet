//! ThemePicker modal key handling.

use crate::app::App;
use crossterm::event::{KeyCode, KeyModifiers};

/// Handle ThemePicker modal key input.
pub async fn handle_theme_picker(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    let count = app.modals.theme_picker_names.len();
    match key.code {
        KeyCode::Esc | KeyCode::Char('q') => {
            app.theme = app.modals.theme_picker_saved_theme.clone();
            app.theme_name = app.modals.theme_picker_saved_name.clone();
            app.mark_dirty();
            app.invalidate_markdown_cache();
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.theme = app.modals.theme_picker_saved_theme.clone();
            app.theme_name = app.modals.theme_picker_saved_name.clone();
            app.mark_dirty();
            app.invalidate_markdown_cache();
            app.modals.active = None;
            true
        }
        KeyCode::Down | KeyCode::Char('j') => {
            if app.modals.theme_picker_selected < count.saturating_sub(1) {
                app.modals.theme_picker_selected += 1;
            }
            if let Some(name) = app.modals.theme_picker_names.get(app.modals.theme_picker_selected) {
                if let Some(theme) = sediman_tui_core::styling::load_theme(name) {
                    app.theme = theme;
                    app.theme_name = name.clone();
                    app.mark_dirty();
                    app.invalidate_markdown_cache();
                }
            }
            true
        }
        KeyCode::Up | KeyCode::Char('k') => {
            if app.modals.theme_picker_selected > 0 {
                app.modals.theme_picker_selected -= 1;
            }
            if let Some(name) = app.modals.theme_picker_names.get(app.modals.theme_picker_selected) {
                if let Some(theme) = sediman_tui_core::styling::load_theme(name) {
                    app.theme = theme;
                    app.theme_name = name.clone();
                    app.mark_dirty();
                    app.invalidate_markdown_cache();
                }
            }
            true
        }
        KeyCode::Enter => {
            crate::commands::theming::save_config_now(&*app);
            app.add_system_message(format!("Theme: {}", app.theme_name));
            app.modals.active = None;
            true
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::{App, AppModal, ChatMessage};
    use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
    use sediman_tui_bridge::ApiClient;

    fn test_app() -> App {
        let mut app = App::new(
            "test".into(),
            Some("gpt-4".into()),
            None,
            true,
            ApiClient::new("/tmp/test_opencode.sock"),
        );
        app.modals.active = Some(AppModal::ThemePicker);
        app.modals.theme_picker_names = vec!["default".into(), "dracula".into(), "monokai".into()];
        app.modals.theme_picker_saved_theme = app.theme.clone();
        app.modals.theme_picker_saved_name = app.theme_name.clone();
        app
    }

    fn key(code: KeyCode) -> KeyEvent {
        KeyEvent::new(code, KeyModifiers::NONE)
    }

    fn ctrl_key(code: KeyCode) -> KeyEvent {
        KeyEvent::new(code, KeyModifiers::CONTROL)
    }

    fn last_message_text(app: &App) -> &str {
        match app.messages.last() {
            Some(ChatMessage::System { text }) => text,
            _ => "",
        }
    }

    #[tokio::test]
    async fn test_escape_restores_saved_theme_and_closes() {
        let mut app = test_app();
        let saved_name = app.modals.theme_picker_saved_name.clone();
        app.theme_name = "modified".into();

        handle_theme_picker(&mut app, key(KeyCode::Esc)).await;
        assert!(app.modals.active.is_none());
        assert_eq!(app.theme_name, saved_name);
    }

    #[tokio::test]
    async fn test_ctrl_c_restores_saved_theme_and_closes() {
        let mut app = test_app();
        let saved_name = app.modals.theme_picker_saved_name.clone();
        app.theme_name = "modified".into();

        handle_theme_picker(&mut app, ctrl_key(KeyCode::Char('c'))).await;
        assert!(app.modals.active.is_none());
        assert_eq!(app.theme_name, saved_name);
    }

    #[tokio::test]
    async fn test_q_restores_saved_theme_and_closes() {
        let mut app = test_app();
        let saved_name = app.modals.theme_picker_saved_name.clone();
        app.theme_name = "modified".into();

        handle_theme_picker(&mut app, key(KeyCode::Char('q'))).await;
        assert!(app.modals.active.is_none());
        assert_eq!(app.theme_name, saved_name);
    }

    #[tokio::test]
    async fn test_down_increments_selected() {
        let mut app = test_app();
        assert_eq!(app.modals.theme_picker_selected, 0);

        handle_theme_picker(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.theme_picker_selected, 1);

        handle_theme_picker(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.theme_picker_selected, 2);

        // Already at last, stays
        handle_theme_picker(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.theme_picker_selected, 2);
    }

    #[tokio::test]
    async fn test_up_decrements_selected() {
        let mut app = test_app();
        app.modals.theme_picker_selected = 2;

        handle_theme_picker(&mut app, key(KeyCode::Up)).await;
        assert_eq!(app.modals.theme_picker_selected, 1);

        handle_theme_picker(&mut app, key(KeyCode::Up)).await;
        assert_eq!(app.modals.theme_picker_selected, 0);

        // Already at 0, stays
        handle_theme_picker(&mut app, key(KeyCode::Up)).await;
        assert_eq!(app.modals.theme_picker_selected, 0);
    }

    #[tokio::test]
    async fn test_j_k_aliases_work() {
        let mut app = test_app();

        handle_theme_picker(&mut app, key(KeyCode::Char('j'))).await;
        assert_eq!(app.modals.theme_picker_selected, 1);

        handle_theme_picker(&mut app, key(KeyCode::Char('k'))).await;
        assert_eq!(app.modals.theme_picker_selected, 0);
    }

    #[tokio::test]
    async fn test_enter_saves_and_closes() {
        let mut app = test_app();
        app.theme_name = "dracula".into();

        handle_theme_picker(&mut app, key(KeyCode::Enter)).await;
        assert!(app.modals.active.is_none());
        let text = last_message_text(&app);
        assert!(text.contains("Theme:"));
    }
}
