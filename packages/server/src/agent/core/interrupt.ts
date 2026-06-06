export class AgentInterruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentInterruptedError";
  }
}

export class InterruptSignal {
  private _triggered = false;
  private _reason = "";

  trigger(reason: string): void {
    this._triggered = true;
    this._reason = reason;
  }

  reset(): void {
    this._triggered = false;
    this._reason = "";
  }

  get triggered(): boolean {
    return this._triggered;
  }

  get reason(): string {
    return this._reason;
  }

  check(): void {
    if (this._triggered) throw new AgentInterruptedError(this._reason);
  }

  private static _instance: InterruptSignal | null = null;

  static get(): InterruptSignal {
    if (!this._instance) this._instance = new InterruptSignal();
    return this._instance;
  }
}
