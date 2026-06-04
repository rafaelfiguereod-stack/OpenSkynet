//! ScheduleBrowser modal key handling.

use crate::app::App;
use crossterm::event::{KeyCode, KeyModifiers};

/// Handle ScheduleBrowser modal key input.
pub async fn handle_schedule_browser(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    match key.code {
        KeyCode::Esc => {
            app.modals.schedule_input.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.modals.schedule_input.clear();
            app.modals.active = None;
            true
        }
        KeyCode::Down | KeyCode::Char('j') => {
            if app.modals.schedule_selected < app.modals.schedule_jobs.len().saturating_sub(1) {
                app.modals.schedule_selected += 1;
            }
            true
        }
        KeyCode::Up | KeyCode::Char('k') => {
            if app.modals.schedule_selected > 0 {
                app.modals.schedule_selected -= 1;
            }
            true
        }
        KeyCode::Enter => {
            if app.modals.schedule_input.is_empty() {
                // Toggle enabled/disabled on selected job
                if let Some(job) = app.modals.schedule_jobs.get(app.modals.schedule_selected).cloned() {
                    if job.enabled {
                        if let Err(e) = app.connection.bridge.remove_schedule(&job.id).await {
                            tracing::warn!("Failed to remove schedule: {e}");
                        }
                        app.add_system_message(format!("Paused job: {}", job.id));
                    } else {
                        app.add_system_message("Job is paused. Press 'd' to delete.".into());
                    }
                }
            } else {
                // Parse: <cron> <task>
                let input = app.modals.schedule_input.trim().to_string();
                let parts: Vec<&str> = input.splitn(2, ' ').collect();
                if parts.len() >= 2 {
                    match app.connection.bridge.add_schedule(parts[0], parts[1]).await {
                        Ok(id) => {
                            app.add_system_message(format!("Scheduled: {}", id));
                            app.modals.schedule_input.clear();
                            if let Ok(jobs) = app.connection.bridge.list_schedules().await {
                                app.modals.schedule_jobs = jobs;
                                app.modals.schedule_selected = 0;
                            }
                        }
                        Err(e) => app.add_error_message(format!("Failed: {}", e)),
                    }
                } else {
                    app.add_error_message("Format: <cron> <task>".into());
                }
            }
            true
        }
        KeyCode::Char('d') => {
            if app.modals.schedule_input.is_empty() {
                if let Some(job) = app.modals.schedule_jobs.get(app.modals.schedule_selected).cloned() {
                    match app.connection.bridge.remove_schedule(&job.id).await {
                        Ok(_) => {
                            app.add_system_message(format!("Deleted: {}", job.task));
                            if app.modals.schedule_selected > 0 { app.modals.schedule_selected -= 1; }
                            if let Ok(jobs) = app.connection.bridge.list_schedules().await {
                                app.modals.schedule_jobs = jobs;
                            }
                        }
                        Err(e) => app.add_error_message(format!("Failed: {}", e)),
                    }
                }
            } else {
                app.modals.schedule_input.push('d');
            }
            true
        }
        KeyCode::Backspace | KeyCode::Delete => {
            if !app.modals.schedule_input.is_empty() {
                app.modals.schedule_input.pop();
            }
            true
        }
        KeyCode::Tab => {
            true
        }
        KeyCode::Char(c) => {
            app.modals.schedule_input.push(c);
            true
        }
        _ => false,
    }
}
