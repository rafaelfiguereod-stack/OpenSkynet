use crate::renderer::Rect;

pub struct ScrollableList {
    pub scroll: usize,
    pub selected: usize,
    pub total: usize,
    pub visible: usize,
}

impl ScrollableList {
    pub fn new(total: usize, scroll: usize, selected: usize, visible: usize) -> Self {
        let mut sl = Self { scroll, selected, total, visible };
        sl.clamp_scroll();
        sl
    }

    pub fn visible_range(&self) -> (usize, usize) {
        let end = (self.scroll + self.visible).min(self.total);
        (self.scroll, end)
    }

    pub fn is_visible(&self, index: usize) -> bool {
        index >= self.scroll && index < self.scroll + self.visible
    }

    pub fn y_for_index(&self, index: usize, start_y: u16) -> Option<u16> {
        if self.is_visible(index) {
            Some(start_y + (index - self.scroll) as u16)
        } else {
            None
        }
    }

    pub fn iter_visible(&self) -> impl Iterator<Item = (usize, bool, usize)> + use<'_> {
        let (start, end) = self.visible_range();
        (start..end).map(move |i| (i, i == self.selected, i - start))
    }

    fn clamp_scroll(&mut self) {
        if self.total == 0 {
            self.scroll = 0;
            return;
        }
        if self.selected < self.scroll {
            self.scroll = self.selected;
        }
        if self.selected >= self.scroll + self.visible {
            self.scroll = self.selected - self.visible + 1;
        }
        self.scroll = self.scroll.min(self.total.saturating_sub(self.visible));
    }

    pub fn visible_height(&self, rect: Rect, header_rows: u16, footer_rows: u16) -> usize {
        rect.height.saturating_sub(header_rows + footer_rows + 2) as usize
    }

    pub fn scroll_thumb(&self) -> Option<(f32, f32)> {
        if self.total <= self.visible || self.visible == 0 {
            return None;
        }
        let ratio = self.visible as f32 / self.total as f32;
        let thumb_h = ratio.max(0.05);
        let track = 1.0 - thumb_h;
        let pos = if self.total > self.visible {
            track * (self.scroll as f32 / (self.total - self.visible) as f32)
        } else {
            0.0
        };
        Some((pos, thumb_h))
    }

    pub fn scroll_percent(&self) -> u16 {
        if self.total == 0 {
            return 0;
        }
        if self.scroll + self.visible >= self.total {
            return 100;
        }
        ((self.scroll + self.visible) * 100 / self.total) as u16
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_clamps_scroll() {
        let sl = ScrollableList::new(20, 0, 15, 5);
        assert_eq!(sl.scroll, 11);
    }

    #[test]
    fn test_visible_range() {
        let sl = ScrollableList::new(20, 5, 7, 10);
        let (start, end) = sl.visible_range();
        assert_eq!(start, 5);
        assert_eq!(end, 15);
    }

    #[test]
    fn test_is_visible() {
        let sl = ScrollableList::new(20, 5, 7, 10);
        assert!(!sl.is_visible(4));
        assert!(sl.is_visible(5));
        assert!(sl.is_visible(14));
        assert!(!sl.is_visible(15));
    }

    #[test]
    fn test_iter_visible() {
        let sl = ScrollableList::new(10, 2, 4, 5);
        let items: Vec<_> = sl.iter_visible().collect();
        assert_eq!(items.len(), 5);
        assert_eq!(items[0], (2, false, 0));
        assert_eq!(items[2], (4, true, 2));
    }

    #[test]
    fn test_empty() {
        let sl = ScrollableList::new(0, 0, 0, 5);
        assert_eq!(sl.scroll, 0);
        let (s, e) = sl.visible_range();
        assert_eq!(s, 0);
        assert_eq!(e, 0);
    }

    #[test]
    fn test_selected_at_start() {
        let sl = ScrollableList::new(20, 10, 0, 5);
        assert_eq!(sl.scroll, 0);
    }

    #[test]
    fn test_scroll_thumb() {
        let sl = ScrollableList::new(100, 50, 55, 10);
        let (pos, h) = sl.scroll_thumb().unwrap();
        assert!(pos > 0.0);
        assert!(h > 0.0 && h < 1.0);
    }

    #[test]
    fn test_scroll_thumb_all_visible() {
        let sl = ScrollableList::new(5, 0, 0, 10);
        assert!(sl.scroll_thumb().is_none());
    }

    #[test]
    fn test_scroll_percent() {
        let sl = ScrollableList::new(100, 0, 0, 10);
        assert_eq!(sl.scroll_percent(), 10);
    }

    #[test]
    fn test_scroll_percent_at_end() {
        let sl = ScrollableList::new(10, 5, 9, 5);
        assert_eq!(sl.scroll_percent(), 100);
    }

    #[test]
    fn test_y_for_index() {
        let sl = ScrollableList::new(20, 5, 7, 10);
        assert_eq!(sl.y_for_index(5, 10), Some(10));
        assert_eq!(sl.y_for_index(8, 10), Some(13));
        assert_eq!(sl.y_for_index(4, 10), None);
    }
}
