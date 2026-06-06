//! SoulEditor modal key handling.

const DEFAULT_SOUL: &str = "You are OpenSkynet, a self-improving browser automation agent.

You are pragmatic, concise, and efficient. You complete browser tasks with minimal steps.

Communication style:
- Be brief but thorough
- When reporting results, lead with the answer
- If something fails, explain what went wrong and what you tried
- Proactively suggest improvements when you notice patterns";

use crate::app::App;
use crossterm::event::{KeyCode, KeyModifiers};

const SOUL_MAX_LENGTH: usize = 4000;

/// Handle SoulEditor modal key input.
pub async fn handle_soul_editor(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    match key.code {
        KeyCode::Esc | KeyCode::Char('q') => {
            app.modals.soul_editor_input.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.soul_editor_input.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Char('r') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            if let Err(e) = app.connection.bridge.reset_soul().await {
                tracing::warn!("Failed to reset soul: {e}");
            }
            app.modals.soul_editor_input = DEFAULT_SOUL.to_string();
            app.add_system_message("Personality reset to default.".into());
            true
        }
        KeyCode::Enter => {
            let text = app.modals.soul_editor_input.trim().to_string();
            if text.is_empty() {
                app.add_error_message("Soul cannot be empty.".into());
                return true;
            }
            match app.connection.bridge.set_soul(&text).await {
                Ok(()) => {
                    app.add_system_message("Soul updated.".to_string());
                    app.modals.soul_editor_input.clear();
                    app.modals.active = None;
                }
                Err(e) => app.add_error_message(format!("Failed to set soul: {}", e)),
            }
            true
        }
        KeyCode::Backspace => {
            app.modals.soul_editor_input.pop();
            true
        }
        KeyCode::Tab => {
            true
        }
        KeyCode::Char(c) => {
            if app.modals.soul_editor_input.len() < SOUL_MAX_LENGTH {
                app.modals.soul_editor_input.push(c);
            }
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
        app.modals.active = Some(AppModal::SoulEditor);
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
            Some(ChatMessage::Error { text }) => text,
            _ => "",
        }
    }

    fn last_is_error(app: &App) -> bool {
        matches!(app.messages.last(), Some(ChatMessage::Error { .. }))
    }

    #[tokio::test]
    async fn test_escape_clears_input_and_closes() {
        let mut app = test_app();
        app.modals.soul_editor_input = "some soul text".into();
        handle_soul_editor(&mut app, key(KeyCode::Esc)).await;
        assert!(app.modals.active.is_none());
        assert!(app.modals.soul_editor_input.is_empty());
    }

    #[tokio::test]
    async fn test_q_clears_input_and_closes() {
        let mut app = test_app();
        app.modals.soul_editor_input = "text".into();
        handle_soul_editor(&mut app, key(KeyCode::Char('q'))).await;
        assert!(app.modals.active.is_none());
        assert!(app.modals.soul_editor_input.is_empty());
    }

    #[tokio::test]
    async fn test_ctrl_c_clears_input_and_closes() {
        let mut app = test_app();
        app.modals.soul_editor_input = "text".into();
        handle_soul_editor(&mut app, ctrl_key(KeyCode::Char('c'))).await;
        assert!(app.modals.active.is_none());
        assert!(app.modals.soul_editor_input.is_empty());
    }

    #[tokio::test]
    async fn test_char_typing_appends_to_input() {
        let mut app = test_app();
        handle_soul_editor(&mut app, key(KeyCode::Char('h'))).await;
        handle_soul_editor(&mut app, key(KeyCode::Char('i'))).await;
        assert_eq!(app.modals.soul_editor_input, "hi");
    }

    #[tokio::test]
    async fn test_backspace_removes_last_char() {
        let mut app = test_app();
        app.modals.soul_editor_input = "abc".into();
        handle_soul_editor(&mut app, key(KeyCode::Backspace)).await;
        assert_eq!(app.modals.soul_editor_input, "ab");
    }

    #[tokio::test]
    async fn test_enter_empty_shows_error() {
        let mut app = test_app();
        app.modals.soul_editor_input = "   ".into();
        handle_soul_editor(&mut app, key(KeyCode::Enter)).await;
        assert!(app.modals.active.is_some());
        assert!(last_is_error(&app));
    }

    #[tokio::test]
    async fn test_enter_nonempty_tries_submit() {
        let mut app = test_app();
        app.modals.soul_editor_input = "Be helpful".into();
        // Will fail to reach bridge (no server), but should attempt
        handle_soul_editor(&mut app, key(KeyCode::Enter)).await;
        // Either closes on success or shows error - both are valid
        assert!(app.modals.active.is_none() || last_is_error(&app));
    }

    #[tokio::test]
    async fn test_tab_is_ignored() {
        let mut app = test_app();
        app.modals.soul_editor_input = "x".into();
        let result = handle_soul_editor(&mut app, key(KeyCode::Tab)).await;
        assert!(result);
        assert_eq!(app.modals.soul_editor_input, "x");
    }
}
