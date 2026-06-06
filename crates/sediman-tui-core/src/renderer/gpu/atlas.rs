use std::collections::HashMap;

use fontdue::Font;

use super::super::Color;

const DEFAULT_ATLAS_WIDTH: u32 = 4096;
const DEFAULT_ATLAS_HEIGHT: u32 = 4096;
const GLYPH_PADDING: u32 = 2;
const BASELINE_RATIO: f32 = 0.8;

fn default_charset() -> Vec<char> {
    let mut v: Vec<char> = (32u8..=126u8).map(|c| c as char).collect();
    for c in 0x2500u16..=0x257Fu16 {
        if let Some(ch) = char::from_u32(c as u32) {
            v.push(ch);
        }
    }
    for c in 0x2580u16..=0x259Fu16 {
        if let Some(ch) = char::from_u32(c as u32) {
            v.push(ch);
        }
    }
    let extra: &[char] = &[
        '•', '✓', '✗', '◆', '◇', '◎', '▶', '▸', '◈', '⋄',
        '★', '✦', '✧', '→', '←', '↑', '↓', '☐', '☑', '○',
        '●', '◉', '⚡', '⚠', '✂', '✎', '⚙', '∞', '━', '│',
        '─', '┄', '┅', '┆', '┇', '┈', '┉', '┊', '┋', '┬',
        '├', '┴', '┤', '┼', '┐', '└', '┘', '░', '▒', '▓',
        '█', '▔', '▕', '▁', '▏',
    ];
    v.extend_from_slice(extra);
    v.sort();
    v.dedup();
    v
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct GlyphInfo {
    pub u0: f32,
    pub v0: f32,
    pub u1: f32,
    pub v1: f32,
    pub advance: f32,
}

pub struct FontAtlasConfig {
    pub atlas_width: u32,
    pub atlas_height: u32,
    pub extra_chars: Vec<char>,
}

impl Default for FontAtlasConfig {
    fn default() -> Self {
        Self {
            atlas_width: DEFAULT_ATLAS_WIDTH,
            atlas_height: DEFAULT_ATLAS_HEIGHT,
            extra_chars: Vec::new(),
        }
    }
}

pub struct FontAtlas {
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    glyphs: HashMap<char, GlyphInfo>,
    font: Font,
    font_size: f32,
    line_height: f32,
    baseline: f32,
    cell_width: f32,
    cursor_x: u32,
    cursor_y: u32,
    glyph_w: u32,
    glyph_h: u32,
    dirty_rect: Option<(u32, u32, u32, u32)>,
}

impl FontAtlas {
    pub fn new(font_data: &[u8], font_size: f32) -> Self {
        Self::with_config(font_data, font_size, FontAtlasConfig::default())
    }

    pub fn with_config(font_data: &[u8], font_size: f32, config: FontAtlasConfig) -> Self {
        let settings = fontdue::FontSettings {
            scale: font_size,
            ..Default::default()
        };
        let font = Font::from_bytes(font_data, settings)
            .expect("Failed to load font");

        let (metrics, _) = font.rasterize('M', font_size);
        let line_height = metrics.height as f32;
        let baseline = line_height * BASELINE_RATIO;
        let cell_width = metrics.advance_width;

        let glyph_w = font_size.ceil() as u32 + GLYPH_PADDING;
        let glyph_h = line_height.ceil() as u32 + GLYPH_PADDING;

        let mut chars = default_charset();
        chars.extend(config.extra_chars.iter().copied());
        chars.sort();
        chars.dedup();

        let atlas_width = config.atlas_width;
        let atlas_height = config.atlas_height;

        let mut pixels = vec![0u8; (atlas_width * atlas_height * 4) as usize];
        let mut glyphs = HashMap::new();

        let mut cx: u32 = 0;
        let mut cy: u32 = 0;

        for &ch in &chars {
            let (m, bitmap) = font.rasterize(ch, font_size);
            if bitmap.is_empty() {
                continue;
            }
            let w = m.width.min(glyph_w as usize) as u32;
            let h = m.height.min(glyph_h as usize) as u32;

            Self::write_glyph_pixels(&mut pixels, atlas_width, cx, cy, w, h, &bitmap, m.width);

            glyphs.insert(ch, GlyphInfo {
                u0: cx as f32 / atlas_width as f32,
                v0: cy as f32 / atlas_height as f32,
                u1: (cx + w) as f32 / atlas_width as f32,
                v1: (cy + h) as f32 / atlas_height as f32,
                advance: m.advance_width,
            });

            cx += glyph_w;
            if cx + glyph_w >= atlas_width {
                cx = 0;
                cy += glyph_h;
            }
        }

        Self {
            pixels,
            width: atlas_width,
            height: atlas_height,
            glyphs,
            font,
            font_size,
            line_height,
            baseline,
            cell_width,
            cursor_x: cx,
            cursor_y: cy,
            glyph_w,
            glyph_h,
            dirty_rect: None,
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn line_height(&self) -> f32 {
        self.line_height
    }

    pub fn baseline(&self) -> f32 {
        self.baseline
    }

    pub fn cell_width(&self) -> f32 {
        self.cell_width
    }

    pub fn pixels(&self) -> &[u8] {
        &self.pixels
    }

    pub fn get(&self, ch: char) -> Option<&GlyphInfo> {
        self.glyphs.get(&ch)
    }

    pub fn get_or_fallback(&self, ch: char) -> &GlyphInfo {
        self.glyphs.get(&ch)
            .or_else(|| self.glyphs.get(&'?'))
            .or_else(|| self.glyphs.get(&' '))
            .expect("Font atlas must have at least space and ? glyphs")
    }

    pub fn rasterize_glyph(&mut self, ch: char) -> Option<GlyphInfo> {
        if self.glyphs.contains_key(&ch) {
            return self.glyphs.get(&ch).copied();
        }

        let (m, bitmap) = self.font.rasterize(ch, self.font_size);
        if bitmap.is_empty() {
            return None;
        }

        let w = m.width.min(self.glyph_w as usize) as u32;
        let h = m.height.min(self.glyph_h as usize) as u32;

        if self.cursor_x + self.glyph_w >= self.width {
            self.cursor_x = 0;
            self.cursor_y += self.glyph_h;
        }

        if self.cursor_y + self.glyph_h >= self.height {
            return None;
        }

        let cx = self.cursor_x;
        let cy = self.cursor_y;

        Self::write_glyph_pixels(&mut self.pixels, self.width, cx, cy, w, h, &bitmap, m.width);

        let info = GlyphInfo {
            u0: cx as f32 / self.width as f32,
            v0: cy as f32 / self.height as f32,
            u1: (cx + w) as f32 / self.width as f32,
            v1: (cy + h) as f32 / self.height as f32,
            advance: m.advance_width,
        };

        self.glyphs.insert(ch, info);
        self.cursor_x += self.glyph_w;
        self.dirty_rect = Some(match self.dirty_rect {
            Some((x0, y0, x1, y1)) => (
                x0.min(cx), y0.min(cy), x1.max(cx + w), y1.max(cy + h),
            ),
            None => (cx, cy, cx + w, cy + h),
        });

        Some(info)
    }

    pub fn take_dirty_rect(&mut self) -> Option<(u32, u32, u32, u32)> {
        self.dirty_rect.take()
    }

    pub fn color_to_f32(color: Color) -> [f32; 4] {
        let (r, g, b) = color.to_rgb();
        [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0, 1.0]
    }

    fn write_glyph_pixels(
        pixels: &mut [u8],
        atlas_width: u32,
        cx: u32,
        cy: u32,
        w: u32,
        h: u32,
        bitmap: &[u8],
        bitmap_width: usize,
    ) {
        for row in 0..h {
            for col in 0..w {
                let src_idx = row as usize * bitmap_width + col as usize;
                let alpha = if src_idx < bitmap.len() { bitmap[src_idx] } else { 0 };
                let dst_idx = ((cy + row) as usize * atlas_width as usize + (cx + col) as usize) * 4;
                pixels[dst_idx] = 255;
                pixels[dst_idx + 1] = 255;
                pixels[dst_idx + 2] = 255;
                pixels[dst_idx + 3] = alpha;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_FONT: &[u8] = include_bytes!("../../../tests/fixtures/DejaVuSansMono.ttf");

    #[test]
    fn test_glyph_info_uv_coordinates_in_range() {
        let font_data = TEST_FONT;
        let atlas = FontAtlas::new(font_data, 16.0);
        for (&ch, info) in &atlas.glyphs {
            assert!(info.u0 >= 0.0 && info.u0 <= 1.0, "u0 out of range for '{}': {}", ch, info.u0);
            assert!(info.v0 >= 0.0 && info.v0 <= 1.0, "v0 out of range for '{}': {}", ch, info.v0);
            assert!(info.u1 >= 0.0 && info.u1 <= 1.0, "u1 out of range for '{}': {}", ch, info.u1);
            assert!(info.v1 >= 0.0 && info.v1 <= 1.0, "v1 out of range for '{}': {}", ch, info.v1);
            assert!(info.u1 > info.u0, "u1 should be > u0 for '{}'", ch);
            assert!(info.v1 > info.v0, "v1 should be > v0 for '{}'", ch);
        }
    }

    #[test]
    fn test_glyphs_do_not_overlap() {
        let font_data = TEST_FONT;
        let atlas = FontAtlas::new(font_data, 16.0);
        let mut rects: Vec<(char, f32, f32, f32, f32)> = atlas.glyphs.iter().map(|(&ch, info)| {
            (ch, info.u0, info.v0, info.u1, info.v1)
        }).collect();
        rects.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        for i in 0..rects.len() {
            for j in (i + 1)..rects.len() {
                let a = &rects[i];
                let b = &rects[j];
                let overlaps = a.1 < b.3 && a.3 > b.1 && a.2 < b.4 && a.4 > b.2;
                assert!(!overlaps, "Glyphs '{}' and '{}' overlap", a.0, b.0);
            }
        }
    }

    #[test]
    fn test_common_characters_present() {
        let font_data = TEST_FONT;
        let atlas = FontAtlas::new(font_data, 16.0);
        for ch in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".chars() {
            assert!(atlas.get(ch).is_some(), "Atlas should contain '{}'", ch);
        }
    }

    #[test]
    fn test_extra_chars_in_config() {
        let font_data = TEST_FONT;
        let config = FontAtlasConfig {
            extra_chars: vec!['♠', '♣', '♥', '♦'],
            ..Default::default()
        };
        let atlas = FontAtlas::with_config(font_data, 16.0, config);
        for ch in &['♠', '♣', '♥', '♦'] {
            assert!(atlas.get(*ch).is_some(), "Atlas should contain '{}' from extra_chars", ch);
        }
    }

    #[test]
    fn test_rasterize_new_glyph() {
        let font_data = TEST_FONT;
        let config = FontAtlasConfig {
            extra_chars: vec![],
            ..Default::default()
        };
        let mut atlas = FontAtlas::with_config(font_data, 16.0, config);
        assert!(atlas.get('♠').is_none());
        let result = atlas.rasterize_glyph('♠');
        assert!(result.is_some(), "Should rasterize new glyph");
        assert!(atlas.get('♠').is_some(), "Glyph should be cached after rasterization");
    }

    #[test]
    fn test_rasterize_cached_glyph_returns_same() {
        let font_data = TEST_FONT;
        let mut atlas = FontAtlas::new(font_data, 16.0);
        let first = atlas.rasterize_glyph('A');
        let second = atlas.rasterize_glyph('A');
        assert_eq!(first, second, "Cached glyph should return same info");
    }

    #[test]
    fn test_dirty_rect_tracking() {
        let font_data = TEST_FONT;
        let config = FontAtlasConfig {
            extra_chars: vec![],
            ..Default::default()
        };
        let mut atlas = FontAtlas::with_config(font_data, 16.0, config);
        assert!(atlas.take_dirty_rect().is_none(), "Initial atlas should have no dirty rect");
        atlas.rasterize_glyph('♠');
        assert!(atlas.take_dirty_rect().is_some(), "After rasterize, dirty rect should be set");
        assert!(atlas.take_dirty_rect().is_none(), "Dirty rect should be consumed");
    }

    #[test]
    fn test_atlas_dimensions() {
        let font_data = TEST_FONT;
        let atlas = FontAtlas::new(font_data, 16.0);
        assert_eq!(atlas.width(), DEFAULT_ATLAS_WIDTH);
        assert_eq!(atlas.height(), DEFAULT_ATLAS_HEIGHT);
    }

    #[test]
    fn test_line_height_and_baseline() {
        let font_data = TEST_FONT;
        let atlas = FontAtlas::new(font_data, 16.0);
        assert!(atlas.line_height() > 0.0, "Line height should be positive");
        assert!(atlas.baseline() > 0.0, "Baseline should be positive");
        assert!(atlas.baseline() < atlas.line_height(), "Baseline should be less than line height");
        let expected_baseline = atlas.line_height() * BASELINE_RATIO;
        assert!((atlas.baseline() - expected_baseline).abs() < 0.01);
    }

    #[test]
    fn test_color_to_f32() {
        let color = Color::from_rgb(255, 128, 0);
        let f32_color = FontAtlas::color_to_f32(color);
        assert_eq!(f32_color[0], 1.0);
        assert!((f32_color[1] - 128.0 / 255.0).abs() < 0.01);
        assert_eq!(f32_color[2], 0.0);
        assert_eq!(f32_color[3], 1.0);
    }

    #[test]
    fn test_get_or_fallback() {
        let font_data = TEST_FONT;
        let atlas = FontAtlas::new(font_data, 16.0);
        let info = atlas.get_or_fallback('A');
        assert!(info.advance > 0.0);
        let unknown_info = atlas.get_or_fallback('⟁');
        assert!(unknown_info.advance > 0.0, "Fallback should return a valid glyph");
    }

    #[test]
    fn test_pixels_buffer_size() {
        let font_data = TEST_FONT;
        let atlas = FontAtlas::new(font_data, 16.0);
        let expected = (DEFAULT_ATLAS_WIDTH * DEFAULT_ATLAS_HEIGHT * 4) as usize;
        assert_eq!(atlas.pixels().len(), expected);
    }

    #[test]
    fn test_custom_config_dimensions() {
        let font_data = TEST_FONT;
        let config = FontAtlasConfig {
            atlas_width: 512,
            atlas_height: 512,
            extra_chars: vec![],
        };
        let atlas = FontAtlas::with_config(font_data, 16.0, config);
        assert_eq!(atlas.width(), 512);
        assert_eq!(atlas.height(), 512);
        assert_eq!(atlas.pixels().len(), 512 * 512 * 4);
    }
}
