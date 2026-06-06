//! SkillBrowser modal key handling.

const VISIBLE_ROWS: u16 = 15;

use crate::app::App;
use crossterm::event::{KeyCode, KeyModifiers};

/// Handle SkillBrowser modal key input.
pub async fn handle_skill_browser(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    let query = app.modals.skill_browser_filter.to_lowercase();
    let filtered: Vec<(usize, &sediman_tui_bridge::HubSkill)> = app
        .modals.skill_browser_skills
        .iter()
        .enumerate()
        .filter(|(_, s)| {
            if query.is_empty() { return true; }
            let searchable = format!("{} {} {} {}", s.name, s.description, s.category, s.author).to_lowercase();
            searchable.contains(&query)
        })
        .collect();
    let filtered_count = filtered.len();

    // Filter mode: typing goes to filter, Esc/Ctrl-C exits filter then modal
    if app.modals.skill_browser_filter_active {
        return handle_skill_browser_filter_mode(app, key, filtered_count).await;
    }

    // Normal mode: j/k/d/i are actions
    match key.code {
        KeyCode::Esc => {
            app.modals.skill_browser_filter.clear();
            app.modals.skill_browser_filter_active = false;
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.skill_browser_filter.clear();
            app.modals.skill_browser_filter_active = false;
            app.modals.active = None;
            true
        }
        KeyCode::Char('/') => {
            app.modals.skill_browser_filter_active = true;
            true
        }
        KeyCode::Down | KeyCode::Char('j') | KeyCode::Tab => {
            if app.modals.skill_browser_selected < filtered_count.saturating_sub(1) {
                app.modals.skill_browser_selected += 1;
                let vr = VISIBLE_ROWS.saturating_sub(1);
                let max_scroll = (app.modals.skill_browser_selected as u16).saturating_sub(vr);
                if app.modals.skill_browser_scroll < max_scroll {
                    app.modals.skill_browser_scroll = max_scroll;
                }
            }
            true
        }
        KeyCode::Up | KeyCode::Char('k') => {
            if app.modals.skill_browser_selected > 0 {
                app.modals.skill_browser_selected -= 1;
                if app.modals.skill_browser_selected < app.modals.skill_browser_scroll as usize {
                    app.modals.skill_browser_scroll = app.modals.skill_browser_selected as u16;
                }
            }
            true
        }
        KeyCode::PageDown => {
            let jump = 5.min(filtered_count.saturating_sub(1));
            app.modals.skill_browser_selected = (app.modals.skill_browser_selected + jump).min(filtered_count.saturating_sub(1));
            let vr = VISIBLE_ROWS.saturating_sub(1);
            let max_scroll = (app.modals.skill_browser_selected as u16).saturating_sub(vr);
            if app.modals.skill_browser_scroll < max_scroll {
                app.modals.skill_browser_scroll = max_scroll;
            }
            true
        }
        KeyCode::PageUp => {
            let jump = 5.min(app.modals.skill_browser_selected);
            app.modals.skill_browser_selected -= jump;
            if app.modals.skill_browser_selected < app.modals.skill_browser_scroll as usize {
                app.modals.skill_browser_scroll = app.modals.skill_browser_selected as u16;
            }
            true
        }
        KeyCode::Enter => {
            if let Some((_, skill)) = filtered.get(app.modals.skill_browser_selected) {
                let name = skill.name.clone();
                if skill.installed {
                    app.modals.skill_browser_filter.clear();
                    app.modals.skill_browser_filter_active = false;
                    app.modals.active = None;
                    crate::commands::skills::handle_run_skill(app, &name).await;
                } else {
                    app.add_system_message(format!("Installing {}...", name));
                    match app.connection.bridge.hub_install(&name, false).await {
                        Ok(()) => {
                            app.add_system_message(format!("Installed {}", name));
                            if !app.modals.skill_browser_installed.contains(&name) {
                                app.modals.skill_browser_installed.push(name.clone());
                            }
                            for s in &mut app.modals.skill_browser_skills {
                                if s.name == name {
                                    s.installed = true;
                                    break;
                                }
                            }
                        }
                        Err(e) => {
                            app.add_error_message(format!("Install failed: {}", e));
                        }
                    }
                }
            }
            true
        }
        KeyCode::Char('i') => {
            if let Some((_, skill)) = filtered.get(app.modals.skill_browser_selected) {
                let name = skill.name.clone();
                app.modals.skill_browser_filter.clear();
                app.modals.skill_browser_filter_active = false;
                app.modals.active = None;
                crate::commands::skills::handle_skill_detail(app, &name).await;
            }
            true
        }
        KeyCode::Char('d') => {
            if let Some((_, skill)) = filtered.get(app.modals.skill_browser_selected) {
                let name = skill.name.clone();
                if app.modals.skill_browser_installed.contains(&name) {
                    app.add_system_message(format!("Uninstalling {}...", name));
                    match app.connection.bridge.delete_skill(&name).await {
                        Ok(()) => {
                            app.modals.skill_browser_installed.retain(|n| n != &name);
                            app.add_system_message(format!("Uninstalled {}", name));
                            for s in &mut app.modals.skill_browser_skills {
                                if s.name == name {
                                    s.installed = false;
                                    break;
                                }
                            }
                        }
                        Err(e) => {
                            app.add_error_message(format!("Uninstall failed: {}", e));
                        }
                    }
                }
            }
            true
        }
        _ => false,
    }
}

/// Handle SkillBrowser filter mode key input.
async fn handle_skill_browser_filter_mode(app: &mut App, key: crossterm::event::KeyEvent, filtered_count: usize) -> bool {
    match key.code {
        KeyCode::Esc => {
            if app.modals.skill_browser_filter.is_empty() {
                app.modals.skill_browser_filter_active = false;
            } else {
                app.modals.skill_browser_filter.clear();
                app.modals.skill_browser_selected = 0;
                app.modals.skill_browser_scroll = 0;
            }
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.skill_browser_filter.clear();
            app.modals.skill_browser_filter_active = false;
            app.modals.skill_browser_selected = 0;
            app.modals.skill_browser_scroll = 0;
            true
        }
        KeyCode::Enter => {
            app.modals.skill_browser_filter_active = false;
            true
        }
        KeyCode::Backspace => {
            app.modals.skill_browser_filter.pop();
            app.modals.skill_browser_selected = 0;
            app.modals.skill_browser_scroll = 0;
            true
        }
        KeyCode::Delete => {
            app.modals.skill_browser_filter.clear();
            app.modals.skill_browser_selected = 0;
            app.modals.skill_browser_scroll = 0;
            true
        }
        KeyCode::Down => {
            if app.modals.skill_browser_selected < filtered_count.saturating_sub(1) {
                app.modals.skill_browser_selected += 1;
                let vr = VISIBLE_ROWS.saturating_sub(1);
                let max_scroll = (app.modals.skill_browser_selected as u16).saturating_sub(vr);
                if app.modals.skill_browser_scroll < max_scroll {
                    app.modals.skill_browser_scroll = max_scroll;
                }
            }
            true
        }
        KeyCode::Up => {
            if app.modals.skill_browser_selected > 0 {
                app.modals.skill_browser_selected -= 1;
                if app.modals.skill_browser_selected < app.modals.skill_browser_scroll as usize {
                    app.modals.skill_browser_scroll = app.modals.skill_browser_selected as u16;
                }
            }
            true
        }
        KeyCode::Tab => {
            true
        }
        KeyCode::Char(c) => {
            app.modals.skill_browser_filter.push(c);
            app.modals.skill_browser_selected = 0;
            app.modals.skill_browser_scroll = 0;
            true
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::{App, AppModal};
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
        app.modals.active = Some(AppModal::SkillBrowser);
        app.modals.skill_browser_skills = vec![
            sediman_tui_bridge::HubSkill {
                name: "skill-a".into(),
                description: "First skill".into(),
                category: "cat".into(),
                author: "dev".into(),
                version: 1,
                trust: "low".into(),
                installed: true,
                scope: "user".into(),
            },
            sediman_tui_bridge::HubSkill {
                name: "skill-b".into(),
                description: "Second skill".into(),
                category: "cat".into(),
                author: "dev".into(),
                version: 1,
                trust: "low".into(),
                installed: false,
                scope: "user".into(),
            },
            sediman_tui_bridge::HubSkill {
                name: "skill-c".into(),
                description: "Third skill".into(),
                category: "cat".into(),
                author: "dev".into(),
                version: 1,
                trust: "low".into(),
                installed: false,
                scope: "user".into(),
            },
        ];
        app
    }

    fn key(code: KeyCode) -> KeyEvent {
        KeyEvent::new(code, KeyModifiers::NONE)
    }

    fn ctrl_key(code: KeyCode) -> KeyEvent {
        KeyEvent::new(code, KeyModifiers::CONTROL)
    }

    #[tokio::test]
    async fn test_escape_closes_modal_and_clears_filter() {
        let mut app = test_app();
        app.modals.skill_browser_filter = "foo".into();
        app.modals.skill_browser_filter_active = false;

        handle_skill_browser(&mut app, key(KeyCode::Esc)).await;
        assert!(app.modals.active.is_none());
        assert!(app.modals.skill_browser_filter.is_empty());
        assert!(!app.modals.skill_browser_filter_active);
    }

    #[tokio::test]
    async fn test_ctrl_c_closes_modal() {
        let mut app = test_app();
        handle_skill_browser(&mut app, ctrl_key(KeyCode::Char('c'))).await;
        assert!(app.modals.active.is_none());
        assert!(!app.modals.skill_browser_filter_active);
    }

    #[tokio::test]
    async fn test_down_up_navigation() {
        let mut app = test_app();
        assert_eq!(app.modals.skill_browser_selected, 0);

        handle_skill_browser(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.skill_browser_selected, 1);

        handle_skill_browser(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.skill_browser_selected, 2);

        // At end, stays
        handle_skill_browser(&mut app, key(KeyCode::Down)).await;
        assert_eq!(app.modals.skill_browser_selected, 2);

        handle_skill_browser(&mut app, key(KeyCode::Up)).await;
        assert_eq!(app.modals.skill_browser_selected, 1);

        // At start, stays
        app.modals.skill_browser_selected = 0;
        handle_skill_browser(&mut app, key(KeyCode::Up)).await;
        assert_eq!(app.modals.skill_browser_selected, 0);
    }

    #[tokio::test]
    async fn test_j_k_tab_navigation() {
        let mut app = test_app();

        handle_skill_browser(&mut app, key(KeyCode::Char('j'))).await;
        assert_eq!(app.modals.skill_browser_selected, 1);

        handle_skill_browser(&mut app, key(KeyCode::Tab)).await;
        assert_eq!(app.modals.skill_browser_selected, 2);

        handle_skill_browser(&mut app, key(KeyCode::Char('k'))).await;
        assert_eq!(app.modals.skill_browser_selected, 1);
    }

    #[tokio::test]
    async fn test_slash_enters_filter_mode() {
        let mut app = test_app();
        assert!(!app.modals.skill_browser_filter_active);

        handle_skill_browser(&mut app, key(KeyCode::Char('/'))).await;
        assert!(app.modals.skill_browser_filter_active);
    }

    #[tokio::test]
    async fn test_filter_mode_typing_and_backspace() {
        let mut app = test_app();
        app.modals.skill_browser_filter_active = true;

        handle_skill_browser(&mut app, key(KeyCode::Char('s'))).await;
        handle_skill_browser(&mut app, key(KeyCode::Char('k'))).await;
        assert_eq!(app.modals.skill_browser_filter, "sk");
        assert_eq!(app.modals.skill_browser_selected, 0);
        assert_eq!(app.modals.skill_browser_scroll, 0);

        handle_skill_browser(&mut app, key(KeyCode::Backspace)).await;
        assert_eq!(app.modals.skill_browser_filter, "s");
    }

    #[tokio::test]
    async fn test_filter_mode_escape_clears_filter_then_exits() {
        let mut app = test_app();
        app.modals.skill_browser_filter_active = true;
        app.modals.skill_browser_filter = "abc".into();

        // First Esc clears filter but stays in filter mode
        handle_skill_browser(&mut app, key(KeyCode::Esc)).await;
        assert!(app.modals.skill_browser_filter.is_empty());
        // Filter was non-empty, so Esc clears it but stays active
        assert!(app.modals.skill_browser_filter_active);

        // Second Esc with empty filter exits filter mode
        handle_skill_browser(&mut app, key(KeyCode::Esc)).await;
        assert!(!app.modals.skill_browser_filter_active);
    }

    #[tokio::test]
    async fn test_filter_mode_ctrl_c_resets() {
        let mut app = test_app();
        app.modals.skill_browser_filter_active = true;
        app.modals.skill_browser_filter = "abc".into();
        app.modals.skill_browser_selected = 2;

        handle_skill_browser(&mut app, ctrl_key(KeyCode::Char('c'))).await;
        assert!(app.modals.skill_browser_filter.is_empty());
        assert!(!app.modals.skill_browser_filter_active);
        assert_eq!(app.modals.skill_browser_selected, 0);
        assert_eq!(app.modals.skill_browser_scroll, 0);
    }

    #[tokio::test]
    async fn test_filter_mode_enter_exits_filter_but_keeps_modal() {
        let mut app = test_app();
        app.modals.skill_browser_filter_active = true;
        app.modals.skill_browser_filter = "skill".into();

        handle_skill_browser(&mut app, key(KeyCode::Enter)).await;
        assert!(!app.modals.skill_browser_filter_active);
        assert!(app.modals.active.is_some());
        assert_eq!(app.modals.skill_browser_filter, "skill");
    }
}
