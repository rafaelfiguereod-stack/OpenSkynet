use crate::renderer::{CellBuffer, Rect, Style};

pub const CORNER_TL: char = '\u{250c}';
pub const CORNER_TR: char = '\u{2510}';
pub const CORNER_BL: char = '\u{2514}';
pub const CORNER_BR: char = '\u{2518}';
pub const CORNER_TL_ROUNDED: char = '\u{256d}';
pub const CORNER_TR_ROUNDED: char = '\u{256e}';
pub const CORNER_BL_ROUNDED: char = '\u{2570}';
pub const CORNER_BR_ROUNDED: char = '\u{256f}';
pub const HORIZONTAL: char = '\u{2500}';
pub const VERTICAL: char = '\u{2502}';

pub fn draw_border(buf: &mut CellBuffer, rect: Rect, top_style: Style, bottom_style: Style) {
    if rect.width < 2 || rect.height < 2 {
        return;
    }
    buf.put_char(rect.x, rect.y, CORNER_TL, top_style);
    buf.put_char(rect.right() - 1, rect.y, CORNER_TR, top_style);
    buf.put_char(rect.x, rect.bottom() - 1, CORNER_BL, bottom_style);
    buf.put_char(rect.right() - 1, rect.bottom() - 1, CORNER_BR, bottom_style);
    for sx in (rect.x + 1)..(rect.right() - 1) {
        buf.put_char(sx, rect.y, HORIZONTAL, top_style);
        buf.put_char(sx, rect.bottom() - 1, HORIZONTAL, bottom_style);
    }
    for sy in (rect.y + 1)..(rect.bottom() - 1) {
        buf.put_char(rect.x, sy, VERTICAL, top_style);
        buf.put_char(rect.right() - 1, sy, VERTICAL, bottom_style);
    }
}

pub fn draw_rounded_border(buf: &mut CellBuffer, rect: Rect, style: Style) {
    if rect.width < 2 || rect.height < 2 {
        return;
    }
    buf.put_char(rect.x, rect.y, CORNER_TL_ROUNDED, style);
    buf.put_char(rect.right() - 1, rect.y, CORNER_TR_ROUNDED, style);
    buf.put_char(rect.x, rect.bottom() - 1, CORNER_BL_ROUNDED, style);
    buf.put_char(rect.right() - 1, rect.bottom() - 1, CORNER_BR_ROUNDED, style);
    for sx in (rect.x + 1)..(rect.right() - 1) {
        buf.put_char(sx, rect.y, HORIZONTAL, style);
        buf.put_char(sx, rect.bottom() - 1, HORIZONTAL, style);
    }
    for sy in (rect.y + 1)..(rect.bottom() - 1) {
        buf.put_char(rect.x, sy, VERTICAL, style);
        buf.put_char(rect.right() - 1, sy, VERTICAL, style);
    }
}

pub fn draw_left_border(buf: &mut CellBuffer, rect: Rect, y: u16, style: Style) {
    if y >= rect.y && y < rect.bottom() {
        buf.put_char(rect.x, y, VERTICAL, style);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::renderer::Color;

    fn style() -> Style {
        Style::new().fg(Color::WHITE)
    }

    #[test]
    fn test_draw_border_corners() {
        let mut buf = CellBuffer::new(10, 5);
        let rect = Rect::new(1, 1, 8, 3);
        draw_border(&mut buf, rect, style(), style());
        assert_eq!(buf.get(1, 1).unwrap().ch, CORNER_TL);
        assert_eq!(buf.get(8, 1).unwrap().ch, CORNER_TR);
        assert_eq!(buf.get(1, 3).unwrap().ch, CORNER_BL);
        assert_eq!(buf.get(8, 3).unwrap().ch, CORNER_BR);
    }

    #[test]
    fn test_draw_border_edges() {
        let mut buf = CellBuffer::new(10, 5);
        let rect = Rect::new(1, 1, 8, 3);
        draw_border(&mut buf, rect, style(), style());
        assert_eq!(buf.get(4, 1).unwrap().ch, HORIZONTAL);
        assert_eq!(buf.get(4, 3).unwrap().ch, HORIZONTAL);
        assert_eq!(buf.get(1, 2).unwrap().ch, VERTICAL);
        assert_eq!(buf.get(8, 2).unwrap().ch, VERTICAL);
    }

    #[test]
    fn test_draw_border_too_small() {
        let mut buf = CellBuffer::new(10, 5);
        draw_border(&mut buf, Rect::new(0, 0, 1, 3), style(), style());
        draw_border(&mut buf, Rect::new(0, 0, 5, 1), style(), style());
    }

    #[test]
    fn test_draw_rounded_border_corners() {
        let mut buf = CellBuffer::new(10, 5);
        let rect = Rect::new(1, 1, 8, 3);
        draw_rounded_border(&mut buf, rect, style());
        assert_eq!(buf.get(1, 1).unwrap().ch, CORNER_TL_ROUNDED);
        assert_eq!(buf.get(8, 1).unwrap().ch, CORNER_TR_ROUNDED);
        assert_eq!(buf.get(1, 3).unwrap().ch, CORNER_BL_ROUNDED);
        assert_eq!(buf.get(8, 3).unwrap().ch, CORNER_BR_ROUNDED);
    }

    #[test]
    fn test_draw_rounded_border_too_small() {
        let mut buf = CellBuffer::new(10, 5);
        draw_rounded_border(&mut buf, Rect::new(0, 0, 1, 3), style());
    }

    #[test]
    fn test_draw_left_border() {
        let mut buf = CellBuffer::new(10, 5);
        let rect = Rect::new(2, 1, 6, 3);
        draw_left_border(&mut buf, rect, 2, style());
        assert_eq!(buf.get(2, 2).unwrap().ch, VERTICAL);
    }
}
