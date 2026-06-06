//! Slash command execution handler.

use crate::app::App;
use crate::constants::*;

/// Execute a slash command.
pub async fn handle_slash(app: &mut App, input: &str) {
    let (cmd, rest) = parse_command(input);

    match cmd {
        // Core commands
        "help" | "h" => {
            app.modals.active = Some(crate::app::AppModal::Help { scroll: 0 });
        }
        "exit" | "quit" | "q" => {
            app.running = false;
        }
        "clear" => {
            app.messages.clear();
            app.add_system_message("Messages cleared.".into());
        }
        "reset" => {
            app.messages.clear();
            app.agent.running = false;
            app.add_system_message("Reset complete.".into());
        }
        "status" => {
            let status = format!(
                "Provider: {}\nModel: {}\nTasks completed: {}\nAgent running: {}\nMessages: {}",
                app.provider,
                app.model.as_deref().unwrap_or("default"),
                app.agent.task_count,
                app.agent.running,
                app.messages.len()
            );
            app.add_system_message(status);
        }
        "compress" => {
            if app.messages.len() > 1 {
                // Compress old messages (keep last 10)
                let compressed_count = app.messages.len().saturating_sub(COMPRESS_KEEP_MESSAGES);
                app.messages = app.messages.split_off(app.messages.len().saturating_sub(COMPRESS_KEEP_MESSAGES));
                app.add_system_message(format!("Compressed {} old messages.", compressed_count));
            } else {
                app.add_system_message("Not enough messages to compress.".into());
            }
        }

        // Agent commands
        "models" | "model" => {
            crate::commands::model::handle_models(app, rest).await;
        }
        "provider" => {
            crate::commands::provider::handle_provider(app, rest).await;
        }
        "soul" => {
            crate::commands::soul::handle_soul(app, rest).await;
        }
        "themes" => {
            crate::commands::theming::handle_themes(app, rest).await;
        }
        "coder" => {
            crate::commands::coder::handle_coder(app, rest).await;
        }
        "terminator" => {
            crate::commands::terminator::handle_terminator(app, rest).await;
        }
        "search" => {
            crate::commands::search::handle_search(app, rest).await;
        }
        "plan" => {
            crate::commands::plan::handle_plan(app, rest).await;
        }

        // Skills
        "skills" | "skill" => {
            crate::commands::skills::handle_skills(app, rest).await;
        }

        // Memory
        "memory" => {
            crate::commands::memory::handle_memory(app, rest).await;
        }
        "remember" => {
            crate::commands::memory::handle_remember(app, rest).await;
        }

        // Schedule
        "schedule" => {
            crate::commands::schedule::handle_schedule(app, rest).await;
        }

        // Sessions
        "sessions" => {
            crate::commands::sessions::handle_sessions(app, rest).await;
        }

        // Browser
        "browser" => {
            crate::commands::browser::handle_browser(app, rest).await;
        }

        // Tasks
        "delegate" => {
            crate::commands::delegate::handle_delegate(app, rest).await;
        }
        "parallel" => {
            crate::commands::delegate::handle_parallel(app, rest).await;
        }

        // Integrations
        "connect" => {
            crate::commands::integration::handle_connect(app, rest).await;
        }

        // Checkpoint
        "checkpoint" => {
            crate::commands::checkpoint::handle_checkpoint(app, rest).await;
        }
        "checkpoint-create" => {
            crate::commands::checkpoint::handle_checkpoint_create(app, rest).await;
        }
        "checkpoint-revert" => {
            crate::commands::checkpoint::handle_checkpoint_revert(app, rest).await;
        }
        "rewind" => {
            crate::commands::checkpoint::handle_rewind(app, rest).await;
        }
        "branch" => {
            crate::commands::checkpoint::handle_branch(app, rest).await;
        }
        "branches" => {
            crate::commands::checkpoint::handle_branches(app, rest).await;
        }

        // Utilities
        "doctor" => {
            crate::commands::doctor::handle_doctor(app, rest).await;
        }
        "update" | "upgrade" => {
            crate::commands::update::handle_update(app, rest).await;
        }

        _ => {
            app.add_error_message(format!("Unknown command: /{}", cmd));
        }
    }
}

/// Parse a command string into (command, args).
fn parse_command(input: &str) -> (&str, &str) {
    let input = input.trim_start_matches('/');
    let parts: Vec<&str> = input.splitn(2, ' ').collect();
    if parts.len() >= 2 {
        (parts[0], parts[1])
    } else {
        (input, "")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::{App, AppModal, ChatMessage};
    use sediman_tui_bridge::ApiClient;

    fn test_app() -> App {
        App::new("test".into(), Some("gpt-4".into()), None, true, ApiClient::new("/tmp/test_opencode.sock"))
    }

    fn system_msg_count(app: &App) -> usize {
        app.messages.iter().filter(|m| matches!(m, ChatMessage::System { .. })).count()
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
    async fn test_clear_clears_messages() {
        let mut app = test_app();
        app.add_system_message("first".into());
        app.add_system_message("second".into());
        assert_eq!(app.messages.len(), 2);

        handle_slash(&mut app, "/clear").await;
        assert_eq!(app.messages.len(), 1);
        assert_eq!(last_message_text(&app), "Messages cleared.");
    }

    #[tokio::test]
    async fn test_reset_clears_messages_and_resets_state() {
        let mut app = test_app();
        app.add_system_message("old msg".into());
        app.agent.running = true;
        app.agent.task_count = 5;

        handle_slash(&mut app, "/reset").await;
        assert!(!app.agent.running);
        assert_eq!(app.messages.len(), 1);
        assert_eq!(last_message_text(&app), "Reset complete.");
    }

    #[tokio::test]
    async fn test_status_outputs_provider_info() {
        let mut app = test_app();
        app.agent.task_count = 3;
        app.agent.running = true;
        app.add_system_message("existing".into());

        handle_slash(&mut app, "/status").await;
        let text = last_message_text(&app).to_string();
        assert!(text.contains("Provider: test"));
        assert!(text.contains("Model: gpt-4"));
        assert!(text.contains("Tasks completed: 3"));
        assert!(text.contains("Agent running: true"));
    }

    #[tokio::test]
    async fn test_status_message_count() {
        let mut app = test_app();
        app.add_user_message("hi".into(), 1);
        app.add_system_message("ok".into());

        handle_slash(&mut app, "/status").await;
        let text = last_message_text(&app).to_string();
        assert!(text.contains("Messages: 2"));
    }

    #[tokio::test]
    async fn test_compress_with_enough_messages() {
        let mut app = test_app();
        for i in 0..20 {
            app.add_system_message(format!("msg {}", i));
        }
        assert_eq!(app.messages.len(), 20);

        handle_slash(&mut app, "/compress").await;
        assert_eq!(app.messages.len(), COMPRESS_KEEP_MESSAGES + 1);
        let text = last_message_text(&app).to_string();
        assert!(text.starts_with("Compressed"));
        assert!(text.contains("old messages"));
    }

    #[tokio::test]
    async fn test_compress_keeps_last_messages() {
        let mut app = test_app();
        for i in 0..15 {
            app.add_system_message(format!("msg {}", i));
        }

        handle_slash(&mut app, "/compress").await;
        let sys_msgs: Vec<_> = app.messages.iter()
            .filter_map(|m| match m {
                ChatMessage::System { text } if text.starts_with("msg") => Some(text.clone()),
                _ => None,
            })
            .collect();
        assert!(sys_msgs.first().unwrap().contains("msg 5"));
        assert!(sys_msgs.last().unwrap().contains("msg 14"));
    }

    #[tokio::test]
    async fn test_compress_not_enough_messages() {
        let mut app = test_app();
        app.add_system_message("only one".into());

        handle_slash(&mut app, "/compress").await;
        assert_eq!(last_message_text(&app), "Not enough messages to compress.");
    }

    #[tokio::test]
    async fn test_compress_zero_messages() {
        let mut app = test_app();

        handle_slash(&mut app, "/compress").await;
        assert_eq!(last_message_text(&app), "Not enough messages to compress.");
    }

    #[tokio::test]
    async fn test_unknown_command_produces_error() {
        let mut app = test_app();

        handle_slash(&mut app, "/foobar").await;
        assert!(last_is_error(&app));
        assert_eq!(last_message_text(&app), "Unknown command: /foobar");
    }

    #[tokio::test]
    async fn test_unknown_command_with_args() {
        let mut app = test_app();

        handle_slash(&mut app, "/nonexistent arg1 arg2").await;
        assert!(last_is_error(&app));
        assert_eq!(last_message_text(&app), "Unknown command: /nonexistent");
    }

    #[tokio::test]
    async fn test_help_sets_modal() {
        let mut app = test_app();
        assert!(app.modals.active.is_none());

        handle_slash(&mut app, "/help").await;
        assert!(matches!(app.modals.active, Some(AppModal::Help { scroll: 0 })));
    }

    #[tokio::test]
    async fn test_help_alias_h() {
        let mut app = test_app();

        handle_slash(&mut app, "/h").await;
        assert!(matches!(app.modals.active, Some(AppModal::Help { .. })));
    }

    #[tokio::test]
    async fn test_exit_sets_running_false() {
        let mut app = test_app();
        assert!(app.running);

        handle_slash(&mut app, "/exit").await;
        assert!(!app.running);
    }

    #[tokio::test]
    async fn test_quit_alias() {
        let mut app = test_app();

        handle_slash(&mut app, "/quit").await;
        assert!(!app.running);
    }

    #[tokio::test]
    async fn test_q_alias() {
        let mut app = test_app();

        handle_slash(&mut app, "/q").await;
        assert!(!app.agent.running);
    }

    #[test]
    fn test_parse_command_simple() {
        assert_eq!(parse_command("/clear"), ("clear", ""));
        assert_eq!(parse_command("/reset"), ("reset", ""));
    }

    #[test]
    fn test_parse_command_with_args() {
        assert_eq!(parse_command("/status"), ("status", ""));
        assert_eq!(parse_command("/model gpt-4o"), ("model", "gpt-4o"));
    }

    #[test]
    fn test_parse_command_multiple_spaces_in_args() {
        assert_eq!(parse_command("/search foo bar baz"), ("search", "foo bar baz"));
    }

    #[test]
    fn test_parse_command_no_slash() {
        assert_eq!(parse_command("clear"), ("clear", ""));
    }
}
