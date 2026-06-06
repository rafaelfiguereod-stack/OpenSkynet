/**
 * Tiered memory system — working, session, and long-term memory with importance scoring.
 */

export enum MemoryTier {
  WORKING = "working",
  SESSION = "session",
  LONG_TERM = "long_term",
}

export enum Channel {
  DECLARATIVE = "declarative",
  PROCEDURAL = "procedural",
}

export interface TieredEntry {
  content: string;
  tier: MemoryTier;
  channel: Channel;
  importance: number;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  metadata: Record<string, unknown>;
  entryId: string;
}

export interface TieredEntryCreate extends Partial<TieredEntry> {
  content: string;
}

export class TieredMemoryEntry implements TieredEntry {
  content: string;
  tier: MemoryTier;
  channel: Channel;
  importance: number;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  metadata: Record<string, unknown>;
  entryId: string;

  constructor(create: TieredEntryCreate) {
    this.content = create.content;
    this.tier = create.tier ?? MemoryTier.WORKING;
    this.channel = create.channel ?? Channel.DECLARATIVE;
    this.importance = create.importance ?? 0.5;
    this.timestamp = create.timestamp ?? Date.now();
    this.accessCount = create.accessCount ?? 0;
    this.lastAccessed = create.lastAccessed ?? this.timestamp;
    this.metadata = create.metadata ?? {};
    this.entryId = create.entryId ?? this._generateId();
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  recencyScore(now: number = Date.now()): number {
    if (!this.timestamp) return 0.5;

    const ageHours = (now - this.timestamp) / (1000 * 60 * 60);

    if (ageHours < 1) return 1.0;
    if (ageHours < 24) return 0.9;
    if (ageHours < 168) return 0.7; // 1 week
    if (ageHours < 720) return 0.5; // 1 month
    return 0.3;
  }

  combinedScore(now: number = Date.now()): number {
    const recency = this.recencyScore(now);
    const access = Math.min(1.0, this.accessCount / 10.0);
    return this.importance * 0.5 + recency * 0.3 + access * 0.2;
  }

  access(): void {
    this.accessCount++;
    this.lastAccessed = Date.now();
  }

  promote(tier: MemoryTier): void {
    this.tier = tier;
    this.timestamp = Date.now();
  }

  toJSON(): TieredEntry {
    return {
      content: this.content,
      tier: this.tier,
      channel: this.channel,
      importance: this.importance,
      timestamp: this.timestamp,
      accessCount: this.accessCount,
      lastAccessed: this.lastAccessed,
      metadata: this.metadata,
      entryId: this.entryId,
    };
  }

  static fromJSON(data: TieredEntry): TieredMemoryEntry {
    return new TieredMemoryEntry(data);
  }
}

export interface WorkingMemoryConfig {
  maxEntries?: number;
  maxChars?: number;
}

export class WorkingMemory {
  private _entries: TieredMemoryEntry[] = [];
  private _maxEntries: number;
  private _maxChars: number;

  constructor(config: WorkingMemoryConfig = {}) {
    this._maxEntries = config.maxEntries ?? 20;
    this._maxChars = config.maxChars ?? 4000;
  }

  add(entry: TieredEntryCreate): TieredMemoryEntry {
    const memEntry = new TieredMemoryEntry({
      ...entry,
      tier: MemoryTier.WORKING,
    });

    this._entries.unshift(memEntry);
    this._trim();
    return memEntry;
  }

  get(entryId: string): TieredMemoryEntry | undefined {
    const entry = this._entries.find((e) => e.entryId === entryId);
    if (entry) {
      entry.access();
    }
    return entry;
  }

  getAll(): TieredMemoryEntry[] {
    return [...this._entries];
  }

  remove(entryId: string): boolean {
    const idx = this._entries.findIndex((e) => e.entryId === entryId);
    if (idx !== -1) {
      this._entries.splice(idx, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this._entries = [];
  }

  get size(): number {
    return this._entries.length;
  }

  get chars(): number {
    return this._entries.reduce((sum, e) => sum + e.content.length, 0);
  }

  private _trim(): void {
    // Trim by entry count
    while (this._entries.length > this._maxEntries) {
      const lowest = this._findLowestScore();
      if (lowest) {
        this._entries = this._entries.filter((e) => e.entryId !== lowest.entryId);
      } else {
        this._entries.pop();
      }
    }

    // Trim by character count
    while (this.chars > this._maxChars && this._entries.length > 1) {
      const lowest = this._findLowestScore();
      if (lowest) {
        this._entries = this._entries.filter((e) => e.entryId !== lowest.entryId);
      } else {
        this._entries.pop();
      }
    }
  }

  private _findLowestScore(): TieredMemoryEntry | null {
    if (this._entries.length === 0) return null;

    let lowest = this._entries[0];
    for (const entry of this._entries) {
      if (entry.combinedScore() < lowest.combinedScore()) {
        lowest = entry;
      }
    }
    return lowest;
  }

  promoteToSession(entryId: string, sessionMemory: SessionMemory): boolean {
    const entry = this.get(entryId);
    if (entry) {
      entry.promote(MemoryTier.SESSION);
      sessionMemory.add(entry.toJSON());
      this.remove(entryId);
      return true;
    }
    return false;
  }

  export(): TieredEntry[] {
    return this._entries.map((e) => e.toJSON());
  }

  import(entries: TieredEntry[]): void {
    for (const data of entries) {
      const entry = new TieredMemoryEntry({ ...data, tier: MemoryTier.WORKING });
      this._entries.push(entry);
    }
    this._trim();
  }
}

export interface SessionMemoryConfig {
  maxEntries?: number;
  maxChars?: number;
}

export class SessionMemory {
  private _entries: Map<string, TieredMemoryEntry> = new Map();
  private _maxEntries: number;
  private _maxChars: number;

  constructor(config: SessionMemoryConfig = {}) {
    this._maxEntries = config.maxEntries ?? 100;
    this._maxChars = config.maxChars ?? 20000;
  }

  add(entry: TieredEntryCreate): TieredMemoryEntry {
    const memEntry = new TieredMemoryEntry({
      ...entry,
      tier: MemoryTier.SESSION,
    });

    this._entries.set(memEntry.entryId, memEntry);
    this._trim();
    return memEntry;
  }

  get(entryId: string): TieredMemoryEntry | undefined {
    const entry = this._entries.get(entryId);
    if (entry) {
      entry.access();
    }
    return entry;
  }

  getAll(): TieredMemoryEntry[] {
    return Array.from(this._entries.values()).sort(
      (a, b) => b.combinedScore() - a.combinedScore()
    );
  }

  remove(entryId: string): boolean {
    return this._entries.delete(entryId);
  }

  clear(): void {
    this._entries.clear();
  }

  get size(): number {
    return this._entries.size;
  }

  get chars(): number {
    let sum = 0;
    for (const entry of this._entries.values()) {
      sum += entry.content.length;
    }
    return sum;
  }

  private _trim(): void {
    const entries = this.getAll();
    const toKeep: TieredMemoryEntry[] = [];
    let totalChars = 0;

    for (const entry of entries) {
      if (toKeep.length >= this._maxEntries || totalChars >= this._maxChars) {
        this._entries.delete(entry.entryId);
      } else {
        toKeep.push(entry);
        totalChars += entry.content.length;
      }
    }
  }

  promoteToLongTerm(entryId: string, longTermMemory: LongTermMemory): boolean {
    const entry = this.get(entryId);
    if (entry) {
      entry.promote(MemoryTier.LONG_TERM);
      longTermMemory.add(entry.toJSON());
      this.remove(entryId);
      return true;
    }
    return false;
  }

  export(): TieredEntry[] {
    return Array.from(this._entries.values()).map((e) => e.toJSON());
  }

  import(entries: TieredEntry[]): void {
    for (const data of entries) {
      const entry = new TieredMemoryEntry({ ...data, tier: MemoryTier.SESSION });
      this._entries.set(entry.entryId, entry);
    }
    this._trim();
  }
}

export interface LongTermMemoryConfig {
  maxEntries?: number;
  maxChars?: number;
}

export class LongTermMemory {
  private _entries: Map<string, TieredMemoryEntry> = new Map();
  private _maxEntries: number;
  private _maxChars: number;

  constructor(config: LongTermMemoryConfig = {}) {
    this._maxEntries = config.maxEntries ?? 500;
    this._maxChars = config.maxChars ?? 100000;
  }

  add(entry: TieredEntryCreate): TieredMemoryEntry {
    const memEntry = new TieredMemoryEntry({
      ...entry,
      tier: MemoryTier.LONG_TERM,
    });

    this._entries.set(memEntry.entryId, memEntry);
    this._trim();
    return memEntry;
  }

  get(entryId: string): TieredMemoryEntry | undefined {
    const entry = this._entries.get(entryId);
    if (entry) {
      entry.access();
    }
    return entry;
  }

  getAll(): TieredMemoryEntry[] {
    return Array.from(this._entries.values()).sort(
      (a, b) => b.combinedScore() - a.combinedScore()
    );
  }

  queryByChannel(channel: Channel): TieredMemoryEntry[] {
    return Array.from(this._entries.values())
      .filter((e) => e.channel === channel)
      .sort((a, b) => b.combinedScore() - a.combinedScore());
  }

  queryByImportance(minImportance: number): TieredMemoryEntry[] {
    return Array.from(this._entries.values())
      .filter((e) => e.importance >= minImportance)
      .sort((a, b) => b.importance - a.importance);
  }

  remove(entryId: string): boolean {
    return this._entries.delete(entryId);
  }

  clear(): void {
    this._entries.clear();
  }

  get size(): number {
    return this._entries.size;
  }

  get chars(): number {
    let sum = 0;
    for (const entry of this._entries.values()) {
      sum += entry.content.length;
    }
    return sum;
  }

  private _trim(): void {
    const entries = this.getAll();
    const toKeep: TieredMemoryEntry[] = [];
    let totalChars = 0;

    for (const entry of entries) {
      if (toKeep.length >= this._maxEntries || totalChars >= this._maxChars) {
        this._entries.delete(entry.entryId);
      } else {
        toKeep.push(entry);
        totalChars += entry.content.length;
      }
    }
  }

  export(): TieredEntry[] {
    return Array.from(this._entries.values()).map((e) => e.toJSON());
  }

  import(entries: TieredEntry[]): void {
    for (const data of entries) {
      const entry = new TieredMemoryEntry({ ...data, tier: MemoryTier.LONG_TERM });
      this._entries.set(entry.entryId, entry);
    }
    this._trim();
  }
}
