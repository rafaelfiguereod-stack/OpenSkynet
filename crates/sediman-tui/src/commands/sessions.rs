use sediman_tui_core::command::{Command, CommandCategory};

use crate::app::{App, AppModal};

pub async fn handle_sessions(app: &mut App, _args: &str) {
    match app.connection.bridge.get_sessions().await {
        Ok(sessions) => {
            app.modals.session_list = sessions;
            app.modals.session_selected = 0;
            app.modals.session_scroll = 0;
            app.modals.session_filter.clear();
            app.modals.active = Some(AppModal::SessionBrowser);
        }
        Err(e) => {
            app.add_error_message(format!("Failed to load sessions: {}", e));
        }
    }
}

pub static CMD_SESSIONS: Command = Command {
    name: "/sessions",
    aliases: &[],
    description: "Browse & manage sessions",
    category: CommandCategory::Sessions,
};
