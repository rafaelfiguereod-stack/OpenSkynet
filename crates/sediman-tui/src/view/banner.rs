use sediman_tui_core::renderer::{CellBuffer, Rect, Style, TextAttributes};
use crate::app::App;

pub fn render_banner(buf: &mut CellBuffer, area: Rect, app: &App) {
    let t = &app.theme;
    let mut y = area.y + 1;

    let muted = Style::new().fg(t.text_muted);
    let success = Style::new().fg(t.success);
    let text_style = Style::new().fg(t.text);

    let gradient: [sediman_tui_core::renderer::Color; 5] = [
        t.primary,
        t.warning,
        t.accent,
        t.secondary,
        t.info,
    ];

    if y >= area.bottom() { return; }
    let top_border = " \u{25c6}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{25c6}";
    buf.draw_str(area.x, y, top_border, Style::new().fg(t.border));
    y += 2;

    let logo: [(&str, sediman_tui_core::renderer::Color); 5] = [
        ("   ____                  _____ __                    __ ", gradient[0]),
        ("  / __ \\____  ___  ____ / ___// /____  ______  ___  / /_", gradient[1]),
        (" / / / / __ \\/ _ \\/ __ \\\\__ \\/ //_/ / / / __ \\/ _ \\/ __/", gradient[2]),
        ("/ /_/ / /_/ /  __/ / / /__/ / ,< / /_/ / / / /  __/ /_ ", gradient[3]),
        ("\\____/ .___/\\___/_/ /_/____/_/|_|\\__, /_/ /_/\\___/\\__/", gradient[4]),
    ];

    for (line, color) in &logo {
        if y >= area.bottom() { return; }
        buf.draw_str(area.x + 1, y, line, Style::new().fg(*color).add_modifier(TextAttributes::bold()));
        y += 1;
    }

    if y >= area.bottom() { return; }
    buf.draw_str(area.x + 1, y, "    /_/                         /____/                 ", Style::new().fg(gradient[4]).add_modifier(TextAttributes::bold()));
    y += 2;

    if y >= area.bottom() { return; }
    buf.draw_str(area.x + 4, y, "Your Terminator.", Style::new().fg(t.accent).add_modifier(TextAttributes::bold()));
    y += 1;

    if y >= area.bottom() { return; }
    let ver = format!("v{}", env!("CARGO_PKG_VERSION"));
    buf.draw_str(area.x + 4, y, &ver, muted);
    y += 1; y += 1;

    if y >= area.bottom() { return; }
    let browser_str = if app.headless { "headless" } else { "headed + vision" };
    buf.draw_str(area.x + 4, y, "\u{25cf} ", success);
    buf.draw_str(area.x + 6, y, &format!("Browser: {}", browser_str), text_style);
    y += 1;

    if y >= area.bottom() { return; }
    let cwd = std::env::current_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| ".".into());
    let cwd_display = if cwd.chars().count() > 50 {
        let tail: String = cwd.chars().skip(cwd.chars().count() - 47).collect();
        format!("...{}", tail)
    } else {
        cwd
    };
    buf.draw_str(area.x + 4, y, "\u{25ce} ", Style::new().fg(t.secondary));
    buf.draw_str(area.x + 6, y, &format!("Path: {}", cwd_display), text_style);
    y += 2;

    if y >= area.bottom() { return; }
    let bot_border = " \u{25c6}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{25c6}";
    buf.draw_str(area.x, y, bot_border, Style::new().fg(t.border));
    y += 2;

    if y >= area.bottom() { return; }
    buf.draw_str(area.x + 4, y, "Type a task or /help to begin.", muted);
}

pub fn render_idle(buf: &mut CellBuffer, area: Rect, app: &App) {
    buf.draw_str(area.x + 2, area.y, "ready \u{2014} type a task or /help",
        Style::new().fg(app.theme.text_muted).add_modifier(TextAttributes::italic()));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::App;
    use sediman_tui_bridge::ApiClient;

    fn test_app() -> App {
        App::new("test".into(), Some("gpt-4".into()), None, true, ApiClient::new("/tmp/test_opencode.sock"))
    }

    fn find_str(buf: &CellBuffer, s: &str) -> bool {
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

    fn find_char(buf: &CellBuffer, ch: char) -> bool {
        for y in 0..buf.height() {
            for x in 0..buf.width() {
                if let Some(cell) = buf.get(x, y) {
                    if cell.ch == ch { return true; }
                }
            }
        }
        false
    }

    #[test]
    fn test_banner_shows_welcome_text() {
        let mut buf = CellBuffer::new(80, 24);
        let app = test_app();
        render_banner(&mut buf, Rect::new(0, 0, 80, 24), &app);
        assert!(find_str(&buf, "Your Terminator."), "should show welcome text");
    }

    #[test]
    fn test_banner_shows_hint_text() {
        let mut buf = CellBuffer::new(80, 24);
        let app = test_app();
        render_banner(&mut buf, Rect::new(0, 0, 80, 24), &app);
        assert!(find_str(&buf, "/help"), "should show /help hint");
    }

    #[test]
    fn test_banner_shows_browser_status_headless() {
        let mut buf = CellBuffer::new(80, 24);
        let app = test_app();
        render_banner(&mut buf, Rect::new(0, 0, 80, 24), &app);
        assert!(find_str(&buf, "Browser"), "should show Browser label");
        assert!(find_str(&buf, "headless"), "should show headless when app.headless is true");
    }

    #[test]
    fn test_banner_shows_browser_status_headed() {
        let mut buf = CellBuffer::new(80, 24);
        let mut app = test_app();
        app.headless = false;
        render_banner(&mut buf, Rect::new(0, 0, 80, 24), &app);
        assert!(find_str(&buf, "headed + vision"), "should show headed + vision when headless is false");
    }

    #[test]
    fn test_banner_shows_path_label() {
        let mut buf = CellBuffer::new(80, 24);
        let app = test_app();
        render_banner(&mut buf, Rect::new(0, 0, 80, 24), &app);
        assert!(find_str(&buf, "Path"), "should show Path label");
    }

    #[test]
    fn test_banner_shows_top_and_bottom_borders() {
        let mut buf = CellBuffer::new(80, 24);
        let app = test_app();
        render_banner(&mut buf, Rect::new(0, 0, 80, 24), &app);
        assert!(find_char(&buf, '\u{25c6}'), "should show diamond decorations");
        assert!(find_char(&buf, '\u{2501}'), "should show horizontal line borders");
    }

    #[test]
    fn test_idle_renders_prompt() {
        let mut buf = CellBuffer::new(80, 1);
        let app = test_app();
        render_idle(&mut buf, Rect::new(0, 0, 80, 1), &app);
        assert!(find_str(&buf, "ready"), "idle should show ready text");
        assert!(find_str(&buf, "/help"), "idle should show /help hint");
    }
}
