use tokio::net::UnixStream;
use futures_util::{StreamExt, SinkExt};
use tokio_tungstenite::{WebSocketStream, tungstenite::Message};
use tokio::net::TcpListener;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

struct WebSocketProxy {
    socket_path: String,
}

impl WebSocketProxy {
    fn new(socket_path: String) -> Self {
        Self { socket_path }
    }

    async fn handle_client(&self, mut ws_stream: WebSocketStream<tokio::net::TcpStream>) {
        // Connect to Unix socket
        let mut unix_stream = match UnixStream::connect(&self.socket_path).await {
            Ok(stream) => stream,
            Err(e) => {
                eprintln!("Failed to connect to Unix socket {}: {}", &self.socket_path, e);
                let _ = ws_stream.send(Message::Text(format!(
                    r#"{{"jsonrpc":"2.0","error":{{"code":-32000,"message":"Failed to connect to backend: {}"}}}}"#,
                    e
                ))).await;
                return;
            }
        };

        eprintln!("Connected to Unix socket: {}", &self.socket_path);

        // Bidirectional proxy between WebSocket and Unix socket
        let (mut ws_sender, ws_receiver) = ws_stream.split();
        let (unix_reader, mut unix_writer) = unix_stream.split();

        // Task to forward WebSocket messages to Unix socket
        let ws_to_unix = async {
            let mut ws_receiver = ws_receiver;
            while let Some(msg_result) = ws_receiver.next().await {
                match msg_result {
                    Ok(msg) => {
                        if msg.is_text() || msg.is_binary() {
                            let mut data = msg.into_data();
                            // Add newline for Python RPC server compatibility
                            data.push(b'\n');
                            if let Err(e) = unix_writer.write_all(&data).await {
                                eprintln!("Failed to write to Unix socket: {}", e);
                                break;
                            }
                            eprintln!("Sent {} bytes to Unix socket", data.len());
                        } else if msg.is_close() {
                            break;
                        }
                    }
                    Err(e) => {
                        eprintln!("WebSocket error: {}", e);
                        break;
                    }
                }
            }
        };

        // Task to forward Unix socket responses to WebSocket
        let unix_to_ws = async {
            let mut reader = BufReader::new(unix_reader);
            let mut line = String::new();

            loop {
                eprintln!("Waiting for Unix socket data...");
                match reader.read_line(&mut line).await {
                    Ok(0) => {
                        eprintln!("Unix socket EOF");
                        break;
                    }
                    Ok(_) => {
                        // Remove trailing newline and send
                        if line.ends_with('\n') {
                            line.pop();
                        }
                        if !line.is_empty() {
                            eprintln!("Read {} bytes from Unix socket", line.len());
                            if let Err(e) = ws_sender.send(Message::text(line.clone())).await {
                                eprintln!("Failed to send to WebSocket: {}", e);
                                break;
                            }
                            eprintln!("Sent response to WebSocket");
                        }
                        // Clear the buffer for next read
                        line.clear();
                    }
                    Err(e) => {
                        eprintln!("Failed to read from Unix socket: {}", e);
                        break;
                    }
                }
            }
        };

        // Run both tasks concurrently
        tokio::select! {
            _ = ws_to_unix => {
                eprintln!("WebSocket to Unix stream ended");
            }
            _ = unix_to_ws => {
                eprintln!("Unix to WebSocket stream ended");
            }
        }
    }
}

pub async fn run_websocket_proxy(socket_path: String) {
    let addr = "127.0.0.1:8765";
    let listener = TcpListener::bind(addr).await.expect("Failed to bind");
    eprintln!("WebSocket proxy server listening on {}", addr);
    eprintln!("Proxying to Unix socket: {}", socket_path);

    let proxy = WebSocketProxy::new(socket_path);

    while let Ok((stream, addr)) = listener.accept().await {
        eprintln!("New WebSocket connection from: {}", addr);
        let ws_stream = match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => {
                eprintln!("Error during WebSocket handshake: {}", e);
                continue;
            }
        };

        // Spawn a task to handle this client
        let proxy_clone = proxy.clone();
        tokio::spawn(async move {
            proxy_clone.handle_client(ws_stream).await;
        });
    }
}

// Implement Clone for WebSocketProxy
impl Clone for WebSocketProxy {
    fn clone(&self) -> Self {
        Self {
            socket_path: self.socket_path.clone(),
        }
    }
}
