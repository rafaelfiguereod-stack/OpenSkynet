use sediman_tui_core::renderer::{CellBuffer, Rect, Style, TextAttributes, truncate_str};
use sediman_tui_core::component::{draw_border, fill_area};
use crate::app::App;
use crate::constants::*;

pub fn show_completion(app: &App) -> bool {
    let input = app.editor.lines().join(" ").trim().to_string();
    input.starts_with('/') && !app.completer.filtered().is_empty()
}

pub fn render_completion_popup(buf: &mut CellBuffer, input_area: Rect, app: &App) {
    let completions = app.completer.filtered();
    if completions.is_empty() {
        return;
    }

    let t = &app.theme;
    let max_items = COMPLETION_MAX_ITEMS.min(completions.len());
    let popup_height = max_items as u16 + 2;
    let popup_y = input_area.y.saturating_sub(popup_height).max(1);
    let popup_area = Rect::new(
        input_area.x,
        popup_y,
        input_area.width.min(COMPLETION_MAX_WIDTH),
        popup_height,
    );

    fill_area(buf, popup_area, Style::new().bg(t.background_panel));

    let border_style = Style::new().fg(t.border);
    draw_border(buf, popup_area, border_style, border_style);

    let title = " Commands ";
    let tlen = title.chars().count().min(popup_area.width as usize - 2);
    let title_display = truncate_str(title, tlen);
    buf.draw_str(popup_area.x + 1, popup_area.y, title_display, Style::new().fg(t.primary).add_modifier(TextAttributes::bold()));

    let selected = app.completer.selected_index();

    // Scroll offset: keep selected item visible in the window
    let scroll_offset = match selected {
        Some(s) if s >= max_items => s - max_items + 1,
        _ => 0,
    };

    let inner_x = popup_area.x + 1;
    let inner_y = popup_area.y + 1;
    for (i, cmd) in completions.iter().skip(scroll_offset).take(max_items).enumerate() {
        if inner_y + i as u16 >= popup_area.bottom() - 1 {
            break;
        }
        let actual_idx = i + scroll_offset;
        let is_selected = selected == Some(actual_idx);
        let text = format!("  {}", cmd);
        if is_selected {
            buf.draw_str(inner_x, inner_y + i as u16, &text, Style::new().fg(t.background).bg(t.primary).add_modifier(TextAttributes::bold()));
        } else {
            buf.draw_str(inner_x, inner_y + i as u16, &text, Style::new().fg(t.text).bg(t.background_panel));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::App;
    use sediman_tui_bridge::ApiClient;

    fn test_app() -> App {
        App::new("test".into(), Some("gpt-4".into()), None, true, ApiClient::new("/tmp/test_opencode.sock"))
    }

    fn find_str_in_buf(buf: &CellBuffer, s: &str) -> bool {
        let chars: Vec<char> = s.chars().collect();
        if chars.is_empty() { return true; }
        'outer: for y in 0..buf.height() {
            for start_x in 0..buf.width() {
                let mut found = true;
                for (i, &expected) in chars.iter().enumerate() {
                    let x = start_x as usize + i;
                    if x >= buf.width() as usize { continue 'outer; }
                    match buf.get(x as u16, y) {
                        Some(cell) if cell.ch == expected => {}
                        _ => { found = false; break; }
                    }
                }
                if found { return true; }
            }
        }
        false
    }

    #[test]
    fn test_completion_popup_renders_commands() {
        let mut buf = CellBuffer::new(80, 24);
        let mut app = test_app();
        app.completer.set_candidates(vec![
            "/help".to_string(),
            "/hello".to_string(),
            "/health".to_string(),
        ]);
        app.completer.complete("/h");
        let input_area = Rect::new(0, 20, 60, 4);
        render_completion_popup(&mut buf, input_area, &app);
        assert!(find_str_in_buf(&buf, "Commands"), "Completion popup should show Commands title");
    }

    #[test]
    fn test_completion_popup_has_border() {
        let mut buf = CellBuffer::new(80, 24);
        let mut app = test_app();
        app.completer.set_candidates(vec![
            "/help".to_string(),
            "/hello".to_string(),
        ]);
        app.completer.complete("/h");
        let input_area = Rect::new(0, 20, 60, 4);
        render_completion_popup(&mut buf, input_area, &app);
        let mut has_border = false;
        for x in 0..40u16 {
            for y in 0..20u16 {
                if let Some(cell) = buf.get(x, y) {
                    if cell.ch == '\u{250c}' || cell.ch == '\u{2510}' || cell.ch == '\u{2514}' || cell.ch == '\u{2518}' {
                        has_border = true;
                    }
                }
            }
        }
        assert!(has_border, "Completion popup should have a border");
    }

    #[test]
    fn test_completion_popup_shows_matching_items() {
        let mut buf = CellBuffer::new(80, 24);
        let mut app = test_app();
        app.completer.set_candidates(vec![
            "/help".to_string(),
            "/hello".to_string(),
            "/health".to_string(),
            "/exit".to_string(),
        ]);
        app.completer.complete("/h");
        let input_area = Rect::new(0, 20, 60, 4);
        render_completion_popup(&mut buf, input_area, &app);
        assert!(find_str_in_buf(&buf, "/help"), "Completion should show /help");
        assert!(!find_str_in_buf(&buf, "/exit"), "Completion should not show /exit");
    }
}
