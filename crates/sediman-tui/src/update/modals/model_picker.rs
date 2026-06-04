//! ModelPicker modal key handling.

use crate::app::{App, AppModal};
use crossterm::event::{KeyCode, KeyModifiers};

/// Handle ModelPicker modal key input.
pub async fn handle_model_picker(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    match key.code {
        KeyCode::Esc => {
            app.modals.model_dialog_filter.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.model_dialog_filter.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Up => {
            let models = app.filtered_models_flat();
            if models.is_empty() { return true; }
            if app.modals.model_dialog_model_idx > 0 {
                app.modals.model_dialog_model_idx -= 1;
            } else {
                app.modals.model_dialog_model_idx = models.len() - 1;
            }
            app.clamp_model_scroll();
            true
        }
        KeyCode::Down => {
            let models = app.filtered_models_flat();
            if models.is_empty() { return true; }
            if app.modals.model_dialog_model_idx < models.len() - 1 {
                app.modals.model_dialog_model_idx += 1;
            } else {
                app.modals.model_dialog_model_idx = 0;
            }
            app.clamp_model_scroll();
            true
        }
        KeyCode::Enter => {
            let models = app.filtered_models_flat();
            if let Some(selected_model) = models.get(app.modals.model_dialog_model_idx).cloned() {
                let provider_name = selected_model.provider.clone();
                let model_id = selected_model.id.clone();
                let base_url = app
                    .modals.available_providers
                    .iter()
                    .find(|p| p.name == provider_name)
                    .and_then(|p| p.default_base_url.clone());
                let needs_key = app
                    .modals.available_providers
                    .iter()
                    .find(|p| p.name == provider_name)
                    .map(|p| p.needs_api_key && !p.has_key)
                    .unwrap_or(false);
                if needs_key {
                    app.modals.connect_target = Some(provider_name.clone());
                    app.modals.connect_pending_model = Some(model_id.clone());
                    app.modals.api_key_input.clear();
                    app.modals.active = Some(AppModal::ApiKeyPrompt);
                    return true;
                }
                if let Err(e) = app.connection.bridge.switch_model(
                    &provider_name,
                    Some(&model_id),
                    base_url.as_deref(),
                ).await {
                    app.add_error_message(format!("Failed to switch: {}", e));
                    app.modals.model_dialog_filter.clear();
                    app.modals.active = None;
                    return true;
                }
                app.provider = provider_name.clone();
                app.model = Some(model_id);
                if let Some(url) = &base_url {
                    app.base_url = Some(url.clone());
                }
                app.add_system_message(format!("Switched to {}", app.display_model_id()));
            }
            app.modals.model_dialog_filter.clear();
            app.modals.active = None;
            if let Ok(providers) = app.connection.bridge.list_providers().await {
                app.modals.available_providers = providers;
            }
            if let Ok(models) = app.connection.bridge.list_models(None).await {
                app.modals.model_list = models;
            }
            true
        }
        KeyCode::Backspace => {
            app.modals.model_dialog_filter.pop();
            app.modals.model_dialog_model_idx = 0;
            app.modals.model_dialog_scroll = 0;
            true
        }
        KeyCode::Tab => {
            true
        }
        KeyCode::Char(c) => {
            app.modals.model_dialog_filter.push(c);
            app.modals.model_dialog_model_idx = 0;
            app.modals.model_dialog_scroll = 0;
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
        app.modals.active = Some(AppModal::ModelPicker);
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
    async fn test_escape_closes_modal_and_clears_filter() {
        let mut app = test_app();
        app.modals.model_dialog_filter = "foo".into();
        handle_model_picker(&mut app, key(KeyCode::Esc)).await;
        assert!(app.modals.active.is_none());
        assert!(app.modals.model_dialog_filter.is_empty());
    }

    #[tokio::test]
    async fn test_ctrl_c_closes_modal_and_clears_filter() {
        let mut app = test_app();
        app.modals.model_dialog_filter = "bar".into();
        handle_model_picker(&mut app, ctrl_key(KeyCode::Char('c'))).await;
        assert!(app.modals.active.is_none());
        assert!(app.modals.model_dialog_filter.is_empty());
    }

    #[tokio::test]
    async fn test_up_down_change_selection_with_models() {
        let mut app = test_app();
        app.modals.model_list = vec![
            sediman_tui_bridge::ModelInfo {
                id: "m1".into(),
                name: "Model 1".into(),
                provider: "p1".into(),
            },
            sediman_tui_bridge::ModelInfo {
                id: "m2".into(),
                name: "Model 2".into(),
                provider: "p1".into(),
            },
            sediman_tui_bridge::ModelInfo {
                id: "m3".into(),
                name: "Model 3".into(),
                provider: "p1".into(),
            },
        ];
        assert_eq!(app.modals.model_dialog_model_idx, 0);

        handle_model_picker(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.model_dialog_model_idx, 1);

        handle_model_picker(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.model_dialog_model_idx, 2);

        // At end, wraps to 0
        handle_model_picker(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.model_dialog_model_idx, 0);

        // At start, wraps to end
        handle_model_picker(&mut app, key(KeyCode::Up)).await;
        assert_eq!(app.modals.model_dialog_model_idx, 2);

        handle_model_picker(&mut app, key(KeyCode::Up)).await;
        assert_eq!(app.modals.model_dialog_model_idx, 1);
    }

    #[tokio::test]
    async fn test_up_down_noop_with_empty_models() {
        let mut app = test_app();
        app.modals.model_list.clear();
        handle_model_picker(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.model_dialog_model_idx, 0);
        handle_model_picker(&mut app, key(KeyCode::Up)).await;
        assert_eq!(app.modals.model_dialog_model_idx, 0);
    }

    #[tokio::test]
    async fn test_char_typing_appends_to_filter_and_resets_index() {
        let mut app = test_app();
        app.modals.model_dialog_model_idx = 3;

        handle_model_picker(&mut app, key(KeyCode::Char('a'))).await;
        assert_eq!(app.modals.model_dialog_filter, "a");
        assert_eq!(app.modals.model_dialog_model_idx, 0);
        assert_eq!(app.modals.model_dialog_scroll, 0);

        handle_model_picker(&mut app, key(KeyCode::Char('b'))).await;
        assert_eq!(app.modals.model_dialog_filter, "ab");
        assert_eq!(app.modals.model_dialog_model_idx, 0);

        handle_model_picker(&mut app, key(KeyCode::Backspace)).await;
        assert_eq!(app.modals.model_dialog_filter, "a");
        assert_eq!(app.modals.model_dialog_model_idx, 0);
        assert_eq!(app.modals.model_dialog_scroll, 0);
    }

    #[tokio::test]
    async fn test_enter_with_no_models_fails_gracefully() {
        let mut app = test_app();
        app.modals.model_list.clear();
        handle_model_picker(&mut app, key(KeyCode::Enter)).await;
        assert!(app.modals.active.is_none());
        assert!(app.modals.model_dialog_filter.is_empty());
    }

    #[tokio::test]
    async fn test_enter_with_model_tries_switch() {
        let mut app = test_app();
        app.modals.model_list = vec![sediman_tui_bridge::ModelInfo {
            id: "gpt-4o".into(),
            name: "GPT-4o".into(),
            provider: "test".into(),
        }];
        app.modals.available_providers = vec![sediman_tui_bridge::ProviderInfo {
            name: "test".into(),
            default_model: "gpt-4o".into(),
            default_base_url: None,
            category: "cloud".into(),
            needs_api_key: false,
            has_key: true,
            auto_detect: false,
        }];
        // This will try to call the bridge and fail (no server), but should close modal
        handle_model_picker(&mut app, key(KeyCode::Enter)).await;
        assert!(app.modals.active.is_none());
        assert!(last_is_error(&app));
    }
}
