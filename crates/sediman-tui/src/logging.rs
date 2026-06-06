use std::fs;
use tracing_subscriber::filter::EnvFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

pub fn setup(verbose: bool) {
    let log_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".terminator")
        .join("logs");

    let _ = fs::create_dir_all(&log_dir);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sediman_tui=debug"));

    let file_appender = tracing_appender::rolling::Builder::new()
        .rotation(tracing_appender::rolling::Rotation::DAILY)
        .filename_prefix("tui")
        .filename_suffix("log")
        .max_log_files(7)
        .build(&log_dir);

    match file_appender {
        Ok(appender) => {
            let (non_blocking, guard) = tracing_appender::non_blocking(appender);
            let file_layer = tracing_subscriber::fmt::layer()
                .with_writer(non_blocking)
                .with_target(true)
                .with_ansi(false)
                .compact();

            let base = tracing_subscriber::registry().with(env_filter).with(file_layer);

            if verbose {
                let stderr_layer = tracing_subscriber::fmt::layer()
                    .with_writer(std::io::stderr)
                    .with_target(false)
                    .compact();
                base.with(stderr_layer).init();
            } else {
                base.init();
            }

            std::mem::forget(guard);
        }
        Err(e) => {
            let path = log_dir.join("tui.log");
            eprintln!(
                "Warning: cannot create log file at {} ({}): logging to stderr only",
                path.display(),
                e
            );
            tracing_subscriber::fmt()
                .with_env_filter(env_filter)
                .with_target(verbose)
                .compact()
                .init();
        }
    }
}
