interface RecordedFrame {
  timestamp: number;
  url: string;
  title: string;
  screenshot: string;
}

export class ScreenRecorder {
  private recording = false;
  private frames: RecordedFrame[] = [];
  private sessionId = "";

  start(sessionId: string): void {
    this.recording = true;
    this.sessionId = sessionId;
    this.frames = [];
  }

  stop(): void {
    this.recording = false;
  }

  captureFrame(screenshot: string, url: string, title: string): void {
    if (!this.recording) return;
    this.frames.push({
      timestamp: Date.now(),
      url,
      title,
      screenshot,
    });
  }

  getFrames(): RecordedFrame[] {
    return this.frames;
  }

  isRecording(): boolean {
    return this.recording;
  }
}
