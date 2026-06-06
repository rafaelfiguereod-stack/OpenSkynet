//! ConnectPicker modal key handling.

use crate::app::{App, AppModal};
use crossterm::event::{KeyCode, KeyModifiers};

/// Handle ConnectPicker modal key input.
pub async fn handle_connect_picker(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    match key.code {
        KeyCode::Esc | KeyCode::Char('q') => {
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.active = None;
            true
        }
        KeyCode::Up => {
            if app.modals.connect_picker_idx > 0 {
                app.modals.connect_picker_idx -= 1;
            } else {
                app.modals.connect_picker_idx = app.modals.connect_integration_list.len().saturating_sub(1);
            }
            if app.modals.connect_picker_idx < app.modals.connect_picker_scroll {
                app.modals.connect_picker_scroll = app.modals.connect_picker_idx;
            }
            true
        }
        KeyCode::Down => {
            let max = app.modals.connect_integration_list.len().saturating_sub(1);
            if app.modals.connect_picker_idx < max {
                app.modals.connect_picker_idx += 1;
            } else {
                app.modals.connect_picker_idx = 0;
                app.modals.connect_picker_scroll = 0;
            }
            let visible = 10;
            if app.modals.connect_picker_idx >= app.modals.connect_picker_scroll + visible {
                app.modals.connect_picker_scroll = app.modals.connect_picker_idx - (visible - 1);
            }
            true
        }
        KeyCode::Enter => {
            if let Some(integ) = app.modals.connect_integration_list.get(app.modals.connect_picker_idx).cloned() {
                let name = integ.name.clone();
                app.modals.connect_target = Some(name);
                app.modals.connect_is_integration = true;
                app.modals.connect_pending_model = None;
                app.modals.api_key_input.clear();
                app.modals.active = Some(AppModal::ApiKeyPrompt);
            }
            true
        }
        KeyCode::Char('d') => {
            if let Some(integ) = app.modals.connect_integration_list.get(app.modals.connect_picker_idx).cloned() {
                let name = integ.name.clone();
                match app
                    .connection.bridge
                    .configure_integration(&name, serde_json::json!({"enabled": false}))
                    .await
                {
                    Ok(_) => {
                        let cap = {
                            let mut c = name.chars();
                            match c.next() {
                                None => String::new(),
                                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                            }
                        };
                        app.add_system_message(format!("{} integration disabled.", cap));
                    }
                    Err(e) => {
                        app.add_error_message(format!("Failed to disable {}: {}", name, e));
                    }
                }
                if let Ok(integrations) = app.connection.bridge.list_integrations().await {
                    app.modals.connect_integration_list = integrations;
                }
            }
            true
        }
        _ => false,
    }
}
