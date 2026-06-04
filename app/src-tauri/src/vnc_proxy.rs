use tokio::net::TcpListener;
use tokio_tungstenite::{WebSocketStream, tungstenite::Message};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// VNC WebSocket proxy that forwards WebSocket connections to VNC server
/// This allows the frontend to connect to VNC using WebSocket protocol
pub async fn run_vnc_proxy(vnc_host: &str, vnc_port: u16, ws_port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let addr = format!("127.0.0.1:{}", ws_port);
    let listener = TcpListener::bind(&addr).await?;
    println!("VNC proxy server listening on {}", addr);
    println!("Proxying to VNC server at {}:{}", vnc_host, vnc_port);

    while let Ok((ws_stream, peer_addr)) = listener.accept().await {
        println!("New VNC WebSocket connection from: {}", peer_addr);
        let vnc_addr = format!("{}:{}", vnc_host, vnc_port);

        tokio::spawn(async move {
            if let Err(e) = handle_vnc_client(ws_stream, &vnc_addr).await {
                eprintln!("VNC client error: {}", e);
            }
        });
    }

    Ok(())
}

async fn handle_vnc_client(ws_stream: TcpStream, vnc_addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Upgrade to WebSocket
    let ws_stream = tokio_tungstenite::accept_async(ws_stream).await?;

    // Connect to VNC server
    let mut vnc_stream = TcpStream::connect(vnc_addr).await?;
    println!("Connected to VNC server at {}", vnc_addr);

    // Split WebSocket and VNC streams
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let (mut vnc_reader, mut vnc_writer) = vnc_stream.split();

    // Flag to track if connection is active
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    // Task to forward WebSocket to VNC
    let ws_to_vnc = async {
        let mut buffer = [0u8; 8192];
        while running_clone.load(Ordering::Relaxed) {
            match ws_receiver.next().await {
                Some(Ok(Message::Binary(data))) => {
                    if let Err(e) = vnc_writer.write_all(&data).await {
                        eprintln!("Failed to write to VNC: {}", e);
                        break;
                    }
                }
                Some(Ok(Message::Close(_))) => {
                    println!("WebSocket close received");
                    break;
                }
                Some(Err(e)) => {
                    eprintln!("WebSocket error: {}", e);
                    break;
                }
                None => break,
                _ => {}
            }
        }
        running_clone.store(false, Ordering::Relaxed);
    };

    // Task to forward VNC to WebSocket
    let vnc_to_ws = async {
        let mut buffer = vec![0u8; 8192];
        while running.load(Ordering::Relaxed) {
            match vnc_reader.read(&mut buffer).await {
                Ok(0) => {
                    println!("VNC server closed connection");
                    break;
                }
                Ok(n) => {
                    if let Err(e) = ws_sender.send(Message::binary(buffer[..n].to_vec())).await {
                        eprintln!("Failed to send to WebSocket: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("VNC read error: {}", e);
                    break;
                }
            }
        }
        running.store(false, Ordering::Relaxed);
    };

    // Run both tasks concurrently
    tokio::select! {
        _ = ws_to_vnc => {
            println!("WebSocket to VNC stream ended");
        }
        _ = vnc_to_ws => {
            println!("VNC to WebSocket stream ended");
        }
    }

    Ok(())
}
