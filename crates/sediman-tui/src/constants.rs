// Layout
pub const INPUT_MIN_LINES: u16 = 3;
pub const INPUT_MAX_LINES: u16 = 15;
pub const INPUT_INNER_WIDTH_SUBTRACT: usize = 12;
pub const INPUT_ROW_OVERHEAD: u16 = 3;

// Modal sizing
pub const MODAL_WIDTH_RATIO: f32 = 0.7;
pub const MODAL_MIN_WIDTH: u16 = 50;
pub const MODAL_MAX_WIDTH: u16 = 80;
pub const MODAL_HEIGHT_RATIO: f32 = 0.8;
pub const MODAL_MIN_HEIGHT: u16 = 20;
pub const MODAL_MAX_HEIGHT: u16 = 40;
pub const PICKER_MODAL_WIDTH_RATIO: f32 = 0.7;
pub const PICKER_MODAL_MAX_WIDTH: u16 = 60;
pub const PICKER_MODAL_MIN_HEIGHT: u16 = 10;
pub const MODAL_HELP_DESC_MAX_SUBTRACT: usize = 25;

// Messages
pub const THINKING_MAX_LINES: usize = 50;
pub const CODE_COLLAPSE_THRESHOLD: usize = 100;
pub const CODE_COLLAPSED_LINES: usize = 50;
pub const INLINE_STEPS_MAX: usize = 5;
pub const ELLIPSIS_WIDTH: usize = 3;
pub const MSG_BORDER_PADDING_SUBTRACT: usize = 6;
pub const MSG_TRUNCATION_OFFSET: usize = 18;
pub const MSG_STEP_TRUNCATION_OFFSET: usize = 4;
pub const MSG_MIN_TRUNCATION_WIDTH: usize = 4;
pub const MSG_INNER_WIDTH_SUBTRACT: usize = 4;
pub const MSG_SCROLLBACK_THRESHOLD: usize = 3;

// Time formatting
pub const SECONDS_PER_MINUTE: u64 = 60;
pub const SECONDS_PER_HOUR: u64 = 3600;

// Agent
pub const AGENT_POLL_INTERVAL_MS: u64 = 100;
pub const COMPRESS_KEEP_MESSAGES: usize = 10;
pub const AGENT_STEPS_CAP: usize = 500;

// Event loop
pub const FRAME_INTERVAL_MS: u64 = 33;
pub const MAX_EVENTS_PER_FRAME: usize = 50;
pub const HEALTH_CHECK_INTERVAL_TICKS: u64 = 10;

// Completion
pub const COMPLETION_MAX_ITEMS: usize = 10;
pub const COMPLETION_MAX_WIDTH: u16 = 40;

// Toast
pub const TOAST_PADDING: u16 = 4;
pub const TOAST_DURATION_SECS: u64 = 3;

// Streaming
pub const STREAMING_MAX_BYTES: usize = 100_000;
