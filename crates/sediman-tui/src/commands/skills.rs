#![allow(dead_code)]
use sediman_tui_core::command::{Command, CommandCategory};
use sediman_tui_core::event::{AppEvent, AgentResultData};

use crate::app::{App, AppModal, ModalLine};
use crate::error::try_send;

pub async fn handle_skills(app: &mut App, args: &str) {
    let args = args.trim();

    if args.starts_with("search ") || args == "search" {
        let query = args.strip_prefix("search").unwrap_or("").trim();
        handle_skills_search(app, query).await;
        return;
    }

    if args.starts_with("run ") {
        let name = args.strip_prefix("run").unwrap_or("").trim();
        if name.is_empty() {
            app.add_system_message("Usage: /skills run <name>".into());
            return;
        }
        handle_run_skill(app, name).await;
        return;
    }

    if args.starts_with("info ") {
        let name = args.strip_prefix("info").unwrap_or("").trim();
        if name.is_empty() {
            app.add_system_message("Usage: /skills info <name>".into());
            return;
        }
        handle_skill_detail(app, name).await;
        return;
    }

    if !args.is_empty() && args != "list" {
        handle_skill_detail(app, args).await;
        return;
    }

    handle_skills_browse(app).await;
}

async fn handle_skills_browse(app: &mut App) {
    match app.connection.bridge.list_all_skills().await {
        Ok(skills) => {
            if skills.is_empty() {
                app.modals.active = Some(AppModal::Info {
                    title: "Skills".into(),
                    lines: vec![
                        ModalLine::blank(),
                        ModalLine::muted("  No skills available."),
                        ModalLine::muted("  Check your connection to the backend."),
                    ],
                    scroll: 0,
                });
                return;
            }
            app.modals.skill_browser_skills = skills;
            app.modals.skill_browser_selected = 0;
            app.modals.skill_browser_filter.clear();
            app.modals.skill_browser_scroll = 0;
            app.modals.skill_browser_installed = app
                .modals.skill_browser_skills
                .iter()
                .filter(|s| s.installed)
                .map(|s| s.name.clone())
                .collect();
            app.modals.active = Some(AppModal::SkillBrowser);
        }
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("Connection failed") || err_str.contains("No such file") || err_str.contains("os error 2") {
                app.modals.active = Some(AppModal::Info {
                    title: "Skills Unavailable".into(),
                    lines: vec![
                        ModalLine::blank(),
                        ModalLine::error("  Cannot load skills — backend not reachable.".to_string()),
                        ModalLine::blank(),
                        ModalLine::muted("  Make sure the sediman backend is running."),
                        ModalLine::muted("  Run: sediman serve"),
                    ],
                    scroll: 0,
                });
            } else {
                app.modals.active = Some(AppModal::Info {
                    title: "Skills".into(),
                    lines: vec![
                        ModalLine::blank(),
                        ModalLine::error(format!("  Failed to load skills: {}", e)),
                    ],
                    scroll: 0,
                });
            }
        }
    }
}

async fn handle_skills_search(app: &mut App, query: &str) {
    if query.is_empty() {
        app.modals.active = Some(AppModal::Info {
            title: "Skills — Search".into(),
            lines: vec![
                ModalLine::blank(),
                ModalLine::muted("  Usage: /skills search <query>"),
            ],
            scroll: 0,
        });
        return;
    }
    match app.connection.bridge.search_skills(query, Some(20)).await {
        Ok(results) => {
            if results.is_empty() {
                app.modals.active = Some(AppModal::Info {
                    title: format!("Skills — Search: {}", query),
                    lines: vec![
                        ModalLine::blank(),
                        ModalLine::muted("  No matches found."),
                    ],
                    scroll: 0,
                });
                return;
            }
            let mut lines = vec![
                ModalLine::heading(format!("  Results for '{}' ({})", query, results.len())),
                ModalLine::blank(),
            ];
            for r in &results {
                let cat = r.category.as_deref().unwrap_or("");
                let source = r.source.as_deref().unwrap_or("");
                let meta = if source.is_empty() {
                    cat.to_string()
                } else if cat.is_empty() {
                    source.to_string()
                } else {
                    format!("{} · {}", cat, source)
                };
                lines.push(ModalLine::primary(format!("  {}", r.name)));
                lines.push(ModalLine::muted(format!("    {} [{}]", r.description, meta)));
            }
            app.modals.active = Some(AppModal::Info {
                title: format!("Skills — Search: {}", query),
                lines,
                scroll: 0,
            });
        }
        Err(e) => {
            app.modals.active = Some(AppModal::Info {
                title: "Skills — Search".into(),
                lines: vec![
                    ModalLine::blank(),
                    ModalLine::error(format!("  Search failed: {}", e)),
                ],
                scroll: 0,
            });
        }
    }
}

pub async fn handle_skill_detail(app: &mut App, name: &str) {
    match app.connection.bridge.get_skill(name).await {
        Ok(skill) => {
            let mut lines = vec![
                ModalLine::heading(format!("  {} v{}", skill.name, skill.version)),
                ModalLine::muted(format!("    {}", skill.description)),
            ];
            if let Some(ref cat) = skill.category {
                lines.push(ModalLine::muted(format!("    Category: {}", cat)));
            }
            lines.push(ModalLine::blank());
            lines.push(ModalLine::accent(format!("  Steps ({})", skill.steps.len())));
            for (i, step) in skill.steps.iter().enumerate() {
                lines.push(ModalLine::normal(format!("    {}. {}", i + 1, step)));
            }
            if !skill.variables.is_empty() {
                lines.push(ModalLine::blank());
                lines.push(ModalLine::accent(format!("  Variables ({})", skill.variables.len())));
                for v in &skill.variables {
                    lines.push(ModalLine::normal(format!("    - {}", v)));
                }
            }
            if let Some(ref w) = skill.when_to_use {
                lines.push(ModalLine::blank());
                lines.push(ModalLine::accent("  When to use"));
                lines.push(ModalLine::normal(format!("    {}", w)));
            }
            if !skill.pitfalls.is_empty() {
                lines.push(ModalLine::blank());
                lines.push(ModalLine::error("  Pitfalls"));
                for p in &skill.pitfalls {
                    lines.push(ModalLine::normal(format!("    - {}", p)));
                }
            }
            if let Some(ref v) = skill.verification {
                lines.push(ModalLine::blank());
                lines.push(ModalLine::accent("  Verification"));
                lines.push(ModalLine::normal(format!("    {}", v)));
            }
            app.modals.active = Some(AppModal::Info {
                title: name.into(),
                lines,
                scroll: 0,
            });
        }
        Err(e) => {
            app.modals.active = Some(AppModal::Info {
                title: name.into(),
                lines: vec![
                    ModalLine::blank(),
                    ModalLine::error(format!("  Skill not found: {}", e)),
                ],
                scroll: 0,
            });
        }
    }
}

pub async fn handle_run_skill(app: &mut App, args: &str) {
    if args.is_empty() {
        app.add_system_message("Usage: /skills run <name>".into());
        return;
    }
    if app.agent.running {
        app.add_system_message("Agent is busy. Wait for it to finish.".into());
        return;
    }
    let Some(event_tx) = app.event_tx.clone() else {
        app.add_error_message("No event channel available.".into());
        return;
    };

    app.add_system_message(format!("Executing skill: {}", args));
    app.agent.running = true;
    app.agent.start = std::time::Instant::now();
    app.interrupt.clear();
    app.start_agent_message(&format!("skill: {}", args));

    let skill_name = args.to_string();
    let socket_path = app.bridge_url().to_string();
    tokio::spawn(async move {
        let bridge = sediman_tui_bridge::ApiClient::new(&socket_path);
        let result = bridge.execute_skill(skill_name.as_str()).await;
        match result {
            Ok(agent_result) => {
                let success = !agent_result.result.is_empty();
                try_send(&event_tx, AppEvent::AgentResult(AgentResultData {
                    success,
                    text: agent_result.result.clone(),
                    elapsed_secs: agent_result.elapsed_secs,
                    skill_created: None,
                    scheduled_job: None,
                }));
            }
            Err(e) => {
                try_send(&event_tx, AppEvent::AgentError(format!("Skill failed: {}", e)));
            }
        }
        try_send(&event_tx, AppEvent::AgentDone);
    });
}

pub static CMD_SKILLS: Command = Command {
    name: "/skills",
    aliases: &[],
    description: "Browse, search & manage skills",
    category: CommandCategory::Skills,
};
