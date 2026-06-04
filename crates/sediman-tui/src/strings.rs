//! User-facing string constants for the TUI application.
//!
//! Centralises all English text displayed to users so that wording
//! is consistent and future localisation is straightforward.

// ── Agent status ──────────────────────────────────────────────────────

pub const MSG_AGENT_BUSY: &str = "Agent is busy. Please wait.";
pub const MSG_AGENT_BUSY_WAIT: &str = "Agent is busy. Wait for it to finish.";
pub const MSG_STARTING: &str = "Starting...";
pub const MSG_WORKING: &str = "Working...";
pub const MSG_TERMINATOR_STARTING: &str = "Terminator starting...";
pub const MSG_NO_RESULT: &str = "No result received";
pub const MSG_NO_RESULT_TERMINATOR: &str = "No result received from Terminator.";
pub const MSG_INTERRUPTED: &str = "Interrupted by user";
pub const MSG_DONE: &str = "done";
pub const MSG_IDLE: &str = "idle";
pub const MSG_RUNNING: &str = "running";

// ── Toast / feedback messages ─────────────────────────────────────────

pub const MSG_MESSAGES_CLEARED: &str = "Messages cleared.";
pub const MSG_CONVERSATION_CLEARED: &str = "Conversation cleared.";
pub const MSG_RESET_COMPLETE: &str = "Reset complete.";
pub const MSG_FULL_RESET_DONE: &str = "Full reset done.";
pub const MSG_PLAN_MODE_ON: &str = "Plan mode: researching without making changes.";
pub const MSG_PLAN_MODE_OFF: &str = "Plan mode off.";
pub const MSG_PLAN_TOGGLE_HINT: &str = "Type /plan again to toggle off.";
pub const MSG_UPDATE_INSTALLED: &str = "Update installed! Restarting...";
pub const MSG_ALREADY_UP_TO_DATE: &str = "Already up to date!";
pub const MSG_CHECKING_UPDATES: &str = "Checking for updates...";
pub const MSG_DOWNLOADING_UPDATE: &str = "Downloading update...";
pub const MSG_PLEASE_WAIT: &str = "Please wait...";
pub const MSG_INSTALLING: &str = "Installing...";
pub const MSG_TERMINAL_AUTO_APPROVED: &str = "Terminal commands auto-approved.";
pub const MSG_TERMINAL_APPROVAL_REQUIRED: &str = "Terminal approval required.";
pub const MSG_PERSONALITY_SET: &str = "Personality set.";
pub const MSG_PERSONALITY_RESET: &str = "Personality reset to default.";
pub const MSG_SOUL_UPDATED: &str = "Soul updated.";
pub const MSG_SOUL_EMPTY: &str = "Soul cannot be empty.";
pub const MSG_NO_EVENT_CHANNEL: &str = "No event channel available.";
pub const MSG_CONNECTED_TO: &str = "Connected to";

// ── Error messages ────────────────────────────────────────────────────

pub const MSG_UNKNOWN_COMMAND: &str = "Unknown command";
pub const MSG_NOT_ENOUGH_TO_COMPRESS: &str = "Not enough messages to compress.";
pub const MSG_SHELL_DENIED: &str = "Shell command denied by permission mode";
pub const MSG_NO_INTEGRATIONS: &str = "No integrations available.";

// ── Banner & welcome ──────────────────────────────────────────────────

pub const MSG_YOUR_TERMINATOR: &str = "Your Terminator.";
pub const MSG_TYPE_TASK_OR_HELP: &str = "Type a task or /help to begin.";
pub const MSG_READY_HINT: &str = "ready \u{2014} type a task or /help";

// ── Input hints ───────────────────────────────────────────────────────

pub const HINT_IDLE: &str = " enter send \u{2502} tab mode \u{2502} / commands";
pub const HINT_RUNNING: &str = " esc cancel";

// ── Modal titles ──────────────────────────────────────────────────────

pub const TITLE_COMMANDS: &str = " Commands Reference ";
pub const TITLE_SELECT_MODEL: &str = "Select Model";
pub const TITLE_SELECT_PROVIDER: &str = "Select Provider";
pub const TITLE_SELECT_INTEGRATION: &str = "Select Integration";
pub const TITLE_SELECT_CODER: &str = "Select Coder Backend";
pub const TITLE_SELECT_SEARCH_MODE: &str = "Select Search Mode";
pub const TITLE_SELECT_BROWSER_MODE: &str = "Select Browser Mode";
pub const TITLE_SELECT_MEMORY_SYSTEM: &str = "Select Memory System";
pub const TITLE_MEMORY: &str = " Memory ";
pub const TITLE_SOUL: &str = " Soul ";
pub const TITLE_THEMES: &str = " Themes ";
pub const TITLE_DOCTOR: &str = " Doctor ";
pub const TITLE_UPDATE_AVAILABLE: &str = " Update Available ";
pub const TITLE_INSTALLING_UPDATE: &str = " Installing Update ";
pub const TITLE_WELCOME: &str = " Welcome to OpenSkynet ";
pub const TITLE_CHOOSE_PROVIDER: &str = " Choose Provider ";
pub const TITLE_ENTER_API_KEY: &str = " Enter API Key ";
pub const TITLE_SKILLS: &str = "Skills";

// ── Modal close hints ─────────────────────────────────────────────────

pub const HINT_Q_CLOSE: &str = " q to close ";
pub const HINT_ESC: &str = " Esc ";
pub const HINT_ESC_CLOSE: &str = " Esc close ";
pub const HINT_ESC_TO_CLOSE: &str = " Esc to close ";

// ── Placeholder text ──────────────────────────────────────────────────

pub const PLACEHOLDER_FILTER: &str = "type to filter...";
pub const PLACEHOLDER_BOT_TOKEN: &str = "bot-token...";
pub const PLACEHOLDER_API_KEY: &str = "sk-...";
pub const PLACEHOLDER_TYPE_TO_ADD: &str = "Type to add...";
pub const PLACEHOLDER_CRON_TASK: &str = "<cron> <task> to add...";
pub const PLACEHOLDER_SEARCH_SESSIONS: &str = "Type to search sessions...";
pub const PLACEHOLDER_SEARCH_SKILLS: &str = "Press / to search...";
pub const PLACEHOLDER_NO_MATCHES_FILTER: &str = "No models match filter.";

// ── Empty-state text ──────────────────────────────────────────────────

pub const EMPTY_NO_ENTRIES_MEMORY: &str = "No entries yet. Type above to add.";
pub const EMPTY_NO_SKILLS_HUB: &str = "No skills found in hub.";
pub const EMPTY_NO_MATCHES_FILTER: &str = "No matches for filter.";
pub const EMPTY_NO_SESSIONS: &str = "No sessions yet. Tasks will appear here.";
pub const EMPTY_NO_SCHEDULED: &str = "No scheduled jobs. Type above to add one.";
pub const EMPTY_NO_CHECKPOINTS: &str = "No checkpoints yet.";
pub const EMPTY_NONE_YET: &str = "none yet";

// ── Sidebar labels ────────────────────────────────────────────────────

pub const SIDEBAR_TAB_SKILLS: &str = "Skills";
pub const SIDEBAR_TAB_MEMORY: &str = "Memory";
pub const SIDEBAR_TAB_SCHEDULE: &str = "Schedule";
pub const SIDEBAR_TAB_STATUS: &str = "Status";
pub const SIDEBAR_STATUS: &str = "  Status";
pub const SIDEBAR_MODEL_LABEL: &str = "  Model   ";
pub const SIDEBAR_MODE_LABEL: &str = "  Mode    ";
pub const SIDEBAR_TASKS_LABEL: &str = "  Tasks   ";
pub const SIDEBAR_BROWSER_LABEL: &str = "  Browser ";
pub const SIDEBAR_AGENT_LABEL: &str = "  Agent   ";
pub const SIDEBAR_HINT_SKILLS: &str = "/skills to load";
pub const SIDEBAR_HINT_MEMORY: &str = "/memory to load";
pub const SIDEBAR_HINT_SCHEDULE: &str = "/schedule to load";

// ── Update modal button labels ────────────────────────────────────────

pub const BTN_UPDATE_NOW: &str = "Update Now";
pub const BTN_SKIP: &str = "Skip";
pub const BTN_RELEASE_NOTES: &str = "Release Notes";

// ── Update modal labels ───────────────────────────────────────────────

pub const LABEL_CURRENT: &str = "Current: ";
pub const LABEL_LATEST: &str = "Latest:  ";
pub const LABEL_RELEASE_NOTES: &str = "Release Notes:";
pub const LABEL_INSTALLING_UPDATE: &str = "Installing update...";

// ── Onboarding text ───────────────────────────────────────────────────

pub const ONBOARDING_TAGLINE: &str = "AI browser employee \u{2014} browse, code, automate";
pub const ONBOARDING_I_CAN_HELP: &str = "I can help you:";
pub const ONBOARDING_HELP_BROWSE: &str = "  \u{2022} Browse the web and extract information";
pub const ONBOARDING_HELP_CODE: &str = "  \u{2022} Write and run code in any language";
pub const ONBOARDING_HELP_DEPLOY: &str = "  \u{2022} Deploy applications to production";
pub const ONBOARDING_HELP_AUTOMATE: &str = "  \u{2022} Automate repetitive tasks";
pub const ONBOARDING_HELP_SKILLS: &str = "  \u{2022} Create AI-powered skills";
pub const ONBOARDING_NEED_KEY: &str = "You'll need an API key from OpenAI, Anthropic, or";
pub const ONBOARDING_SETUP_NEXT: &str = "another LLM provider. We'll set that up next.";
pub const ONBOARDING_PRESS_ENTER: &str = "  Press Enter to start setup  ";
pub const ONBOARDING_PICK_PROVIDER: &str = "Pick your AI provider:";
pub const ONBOARDING_CONNECTING: &str = "  Connecting to backend...";
pub const ONBOARDING_ENTER_KEY: &str = "Enter your API key:";
pub const ONBOARDING_TYPE_KEY_HINT: &str = "Type your key (input is hidden)  |  Enter: finish";

// ── Soul editor labels ────────────────────────────────────────────────

pub const SOUL_DEFAULT_ACTIVE: &str = "Default personality active";
pub const SOUL_CURRENT: &str = "Current personality:";
pub const SOUL_FOOTER: &str = " Enter save \u{2502} Ctrl+R reset \u{2502} Type to edit ";

// ── Footer hints for various modals ───────────────────────────────────

pub const FOOTER_CONNECT_NAV: &str =
    "\u{2191}\u{2193} nav \u{2502} Enter connect \u{2502} d disconnect \u{2502} Esc close";
pub const FOOTER_API_KEY_CONFIRM: &str = " Enter confirm \u{2502} Esc cancel";
pub const FOOTER_MEMORY_EDITOR: &str =
    " Enter add \u{2502} d delete \u{2502} \u{2191}\u{2193} navigate ";
pub const FOOTER_SKILL_BROWSER: &str =
    " Enter run/inst \u{2502} d uninstall \u{2502} i info \u{2502} j/k nav \u{2502} / search ";
pub const FOOTER_SESSION_BROWSER: &str =
    " Enter view \u{2502} d delete \u{2502} \u{2191}\u{2193} navigate \u{2502} Type to search ";
pub const FOOTER_SCHEDULE_BROWSER: &str =
    " Enter toggle/add \u{2502} d/\u{232b} delete \u{2502} \u{2191}\u{2193} navigate \u{2502} Type to add ";
pub const FOOTER_THEME_PICKER: &str =
    " \u{2191}\u{2193} navigate \u{2502} Enter select \u{2502} Esc cancel ";
pub const FOOTER_DOCTOR: &str =
    "Enter: install | r: re-check | \u{2191}\u{2193}: navigate";
pub const FOOTER_MEMORY_SYSTEM: &str =
    "Enter: select | \u{2191}\u{2193}: navigate | Esc: cancel";
pub const FOOTER_MEMORY_MENU: &str =
    "Enter: select | \u{2191}\u{2193}: navigate | Esc: cancel";
pub const FOOTER_ONBOARDING_NAV: &str =
    "\u{2191}\u{2193}: choose  |  Enter: confirm";
pub const FOOTER_UPDATE_NOTES_NAV: &str =
    "\u{2191}\u{2193}: scroll | Enter: confirm | Esc: close";
pub const FOOTER_UPDATE_NAV: &str =
    "\u{2190}\u{2192}/Tab: choose | Enter: confirm | Esc: close";

// ── Memory menu options ───────────────────────────────────────────────

pub const MEMORY_MENU_VIEW_STATS: &str = "View Memory Stats";
pub const MEMORY_MENU_SWITCH_SYSTEM: &str = "Switch Memory System";
pub const MEMORY_MENU_SHOW_CURRENT: &str = "Show Current System";

// ── Integration status labels ─────────────────────────────────────────

pub const STATUS_CONNECTED: &str = "connected";
pub const STATUS_CONFIGURED: &str = "configured";
pub const STATUS_NOT_CONFIGURED: &str = "not configured";

// ── Browser mode labels ───────────────────────────────────────────────

pub const BROWSER_HEADLESS: &str = "headless";
pub const BROWSER_HEADED_VISION: &str = "headed + vision";
pub const BROWSER_HEADLESS_DESC: &str = "headless - no browser window (faster)";
pub const BROWSER_HEADED_DESC: &str = "headed - show browser window";

// ── Search mode labels ────────────────────────────────────────────────

pub const SEARCH_MODE_AUTO_DESC: &str = "auto - agent chooses best method";
pub const SEARCH_MODE_SIMPLE_DESC: &str = "simple - web_search (fast, simple)";
pub const SEARCH_MODE_ADVANCED_DESC: &str = "advanced - SearchSDK (complex research)";
pub const SEARCH_MODE_PICKER_DESC_WIDE: &str =
    "Auto: agent chooses, Simple: web_search, Advanced: SearchSDK";
pub const SEARCH_MODE_PICKER_DESC_NARROW: &str = "Auto, Simple, Advanced";

// ── Theme picker ──────────────────────────────────────────────────────

pub const THEME_CURRENT_SUFFIX: &str = " (current)";

// ── Streaming section labels ──────────────────────────────────────────

pub const SECTION_THINKING: &str = "Thinking";
pub const SECTION_STEPS: &str = "Steps";
pub const SECTION_RESPONSE: &str = "Response";
pub const SECTION_COLLAPSED: &str = "(collapsed)";
pub const SECTION_COLLAPSED_EXPAND: &str = "(collapsed, press Space to expand)";

// ── Message labels ────────────────────────────────────────────────────

pub const MSG_TASK_PREFIX: &str = "Task #";
pub const MSG_NEW_CONTENT: &str = " \u{2193} New content ";

// ── Title bar labels ──────────────────────────────────────────────────

pub const TITLEBAR_RECONNECTING: &str = " \u{26a0} reconnecting ";

// ── Connection/backend status ─────────────────────────────────────────

pub const MSG_BACKEND_NOT_REACHABLE: &str =
    "  Cannot load skills \u{2014} backend not reachable.";
pub const MSG_MAKE_SURE_BACKEND_RUNNING: &str =
    "  Make sure the sediman backend is running.";
pub const MSG_RUN_SEDIMAN_SERVE: &str = "  Run: sediman serve";

// ── Scroll indicator ──────────────────────────────────────────────────

pub const ELAPSED_LESS_THAN_1S: &str = "< 1s";

// ── Doctor install status ─────────────────────────────────────────────

pub const DOCTOR_INSTALL_DONE: &str = "  \u{2713} Done \u{2014} re-checking...";
