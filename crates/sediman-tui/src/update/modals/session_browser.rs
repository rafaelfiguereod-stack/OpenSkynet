//! SessionBrowser modal key handling.

use crate::app::App;
use crossterm::event::{KeyCode, KeyModifiers};

/// Handle SessionBrowser modal key input.
pub async fn handle_session_browser(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    let query = app.modals.session_filter.to_lowercase();
    let filtered_count = app.modals.session_list
        .iter()
        .filter(|s| {
            if query.is_empty() { return true; }
            let searchable = format!("{} {}", s.task, s.id).to_lowercase();
            searchable.contains(&query)
        })
        .count();

    match key.code {
        KeyCode::Esc => {
            app.modals.session_filter.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.session_filter.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Down | KeyCode::Char('j') => {
            if app.modals.session_selected < filtered_count.saturating_sub(1) {
                app.modals.session_selected += 1;
            }
            true
        }
        KeyCode::Up | KeyCode::Char('k') => {
            if app.modals.session_selected > 0 {
                app.modals.session_selected -= 1;
            }
            true
        }
        KeyCode::Enter => {
            // View session detail
            let filtered: Vec<&sediman_tui_bridge::SessionInfo> = app.modals.session_list
                .iter()
                .filter(|s| {
                    if query.is_empty() { return true; }
                    let searchable = format!("{} {}", s.task, s.id).to_lowercase();
                    searchable.contains(&query)
                })
                .collect();
            if let Some(session) = filtered.get(app.modals.session_selected) {
                let sid = session.id.clone();
                let task_preview = session.task.clone();
                match app.connection.bridge.get_session_detail(&sid).await {
                    Ok(detail) => {
                        let mut lines = vec![
                            crate::app::ModalLine::heading(format!("  Session #{}", sid)),
                            crate::app::ModalLine::muted(format!("  Task: {}", task_preview)),
                            crate::app::ModalLine::muted(format!("  Created: {}", session.created_at)),
                            crate::app::ModalLine::blank(),
                        ];
                        if let Some(steps) = detail.get("steps").and_then(|s| s.as_array()) {
                            lines.push(crate::app::ModalLine::accent(format!("  Steps ({})", steps.len())));
                            for step in steps.iter().take(20) {
                                let action = step.get("action").and_then(|a| a.as_str()).unwrap_or("");
                                if !action.is_empty() {
                                    lines.push(crate::app::ModalLine::normal(format!("    {}", action)));
                                }
                            }
                        }
                        if let Some(result) = session.result.as_deref() {
                            if !result.is_empty() {
                                lines.push(crate::app::ModalLine::blank());
                                lines.push(crate::app::ModalLine::accent("  Result"));
                                let truncated: String = result.chars().take(300).collect();
                                lines.push(crate::app::ModalLine::normal(format!("    {}...", truncated)));
                            }
                        }
                        app.modals.active = Some(crate::app::AppModal::Info {
                            title: format!("Session #{}", sid),
                            lines,
                            scroll: 0,
                        });
                    }
                    Err(e) => {
                        app.add_error_message(format!("Failed to load session: {}", e));
                    }
                }
            }
            true
        }
        KeyCode::Char('d') => {
            if app.modals.session_filter.is_empty() {
                let filtered: Vec<&sediman_tui_bridge::SessionInfo> = app.modals.session_list
                    .iter()
                    .filter(|s| {
                        if query.is_empty() { return true; }
                        let searchable = format!("{} {}", s.task, s.id).to_lowercase();
                        searchable.contains(&query)
                    })
                    .collect();
                if let Some(session) = filtered.get(app.modals.session_selected) {
                    let sid = session.id.clone();
                    match app.connection.bridge.delete_session(&sid).await {
                        Ok(()) => {
                            app.add_system_message(format!("Deleted session #{}", sid));
                            if app.modals.session_selected > 0 {
                                app.modals.session_selected -= 1;
                            }
                            // Refresh list
                            if let Ok(sessions) = app.connection.bridge.get_sessions().await {
                                app.modals.session_list = sessions;
                            }
                        }
                        Err(e) => app.add_error_message(format!("Failed to delete: {}", e)),
                    }
                }
            } else {
                app.modals.session_filter.push('d');
            }
            true
        }
        KeyCode::Backspace | KeyCode::Delete => {
            if !app.modals.session_filter.is_empty() {
                app.modals.session_filter.pop();
                app.modals.session_selected = 0;
            }
            true
        }
        KeyCode::Tab => {
            // Ignore Tab - used for UI navigation elsewhere
            true
        }
        KeyCode::Char(c) => {
            app.modals.session_filter.push(c);
            app.modals.session_selected = 0;
            true
        }
        _ => false,
    }
}
