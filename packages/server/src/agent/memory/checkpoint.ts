export interface Checkpoint {
  id: string;
  name: string;
  targetDir: string;
  createdAt: string;
}

export class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();

  maybeCheckpoint(name: string, targetDir?: string): Checkpoint | null {
    const id = `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cp: Checkpoint = {
      id,
      name,
      targetDir: targetDir ?? process.cwd(),
      createdAt: new Date().toISOString(),
    };
    this.checkpoints.set(id, cp);
    return cp;
  }

  revert(checkpointId: string, _targetDir?: string): boolean {
    return this.checkpoints.has(checkpointId);
  }

  listCheckpoints(_targetDir?: string): Checkpoint[] {
    return Array.from(this.checkpoints.values());
  }
}
