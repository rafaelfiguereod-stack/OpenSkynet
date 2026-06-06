/**
 * ToolResultBuilder - Smart result formatting
 *
 * Performance-optimized implementation with:
 * - Cached regex patterns
 * - Reduced string allocations
 * - Optimized buffer operations
 */

const DEFAULT_MAX_CHARS = 50_000;
const DEFAULT_MAX_LINE_LENGTH = 2000;
const TRUNCATION_MARKER = '[...truncated]';
const TRUNCATION_MESSAGE = 'Output is truncated to fit in the message.';

// Cache regex pattern to avoid recreation on every write
const LINE_SPLIT_REGEX = /[^\r\n]*(?:\r\n|[\n\r])|[^\r\n]+/g;
const LINE_BREAK_REGEX = /[\r\n]+$/;

export interface ToolResultBuilderOptions {
  maxChars?: number;
  maxLineLength?: number | null;
}

export interface ToolResult {
  readonly output: string;
  readonly isError: boolean;
  readonly message: string;
  readonly truncated: boolean;
  readonly brief?: string;
}

export class ToolResultBuilder {
  private readonly maxChars: number;
  private readonly maxLineLength: number | null;
  private readonly buffer: string[] = [];
  private nCharsValue = 0;
  private truncationHappened = false;
  private cachedOutput: string | null = null;

  constructor(options: ToolResultBuilderOptions = {}) {
    this.maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
    this.maxLineLength =
      options.maxLineLength === undefined ? DEFAULT_MAX_LINE_LENGTH : options.maxLineLength;

    if (this.maxLineLength !== null && this.maxLineLength <= TRUNCATION_MARKER.length) {
      throw new Error('maxLineLength must be greater than truncation marker length.');
    }
  }

  get nChars(): number {
    return this.nCharsValue;
  }

  write(text: string): number {
    // Invalidate cached output
    this.cachedOutput = null;

    if (this.nCharsValue >= this.maxChars) {
      if (text.length > 0 && !this.truncationHappened) {
        this.buffer.push(TRUNCATION_MARKER);
        this.nCharsValue += TRUNCATION_MARKER.length;
        this.truncationHappened = true;
      }
      return 0;
    }

    // Use cached regex for line splitting
    LINE_SPLIT_REGEX.lastIndex = 0;
    const lines = text.match(LINE_SPLIT_REGEX) ?? [];
    if (lines.length === 0) return 0;

    let charsWritten = 0;
    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];

      if (this.nCharsValue >= this.maxChars) {
        if (!this.truncationHappened) {
          this.buffer.push(TRUNCATION_MARKER);
          this.nCharsValue += TRUNCATION_MARKER.length;
          this.truncationHappened = true;
        }
        break;
      }

      const remainingChars = this.maxChars - this.nCharsValue;
      const limit =
        this.maxLineLength === null
          ? remainingChars
          : Math.min(remainingChars, this.maxLineLength);

      let line = originalLine;
      if (line.length > limit) {
        const lineBreakMatch = LINE_BREAK_REGEX.exec(line);
        const lineBreak = lineBreakMatch?.[0] ?? '';
        const suffix = TRUNCATION_MARKER + lineBreak;
        const effectiveMaxLength = Math.max(limit, suffix.length);
        line = line.slice(0, effectiveMaxLength - suffix.length) + suffix;
        this.truncationHappened = true;
      }

      this.buffer.push(line);
      const lineLen = line.length;
      charsWritten += lineLen;
      this.nCharsValue += lineLen;
    }

    return charsWritten;
  }

  ok(message = '', options: { brief?: string } = {}): ToolResult {
    const output = this.getOutput();
    const finalMessage = this.buildFinalMessage(message);

    const shouldAppendMessage =
      finalMessage.length > 0 && (this.truncationHappened || output.length === 0);

    return {
      isError: false,
      output: shouldAppendMessage
        ? this.appendMessageToOutput(output, finalMessage)
        : output,
      message: finalMessage,
      truncated: this.truncationHappened,
      brief: options.brief,
    };
  }

  error(message: string, options: { brief?: string } = {}): ToolResult {
    const output = this.getOutput();
    const finalMessage = this.truncationHappened
      ? message.length === 0
        ? TRUNCATION_MESSAGE
        : `${message} ${TRUNCATION_MESSAGE}`
      : message;

    return {
      isError: true,
      output: finalMessage.length === 0
        ? output
        : output.length === 0
          ? finalMessage
          : output.endsWith('\n')
            ? `${output}${finalMessage}`
            : `${output}\n${finalMessage}`,
      message: finalMessage,
      truncated: this.truncationHappened,
      brief: options.brief,
    };
  }

  /**
   * Get output with caching to avoid repeated joins
   */
  private getOutput(): string {
    if (this.cachedOutput === null) {
      this.cachedOutput = this.buffer.join('');
    }
    return this.cachedOutput;
  }

  /**
   * Build final message with optimizations
   */
  private buildFinalMessage(message: string): string {
    if (message.length > 0 && !message.endsWith('.')) {
      message += '.';
    }
    if (this.truncationHappened) {
      return message.length === 0 ? TRUNCATION_MESSAGE : `${message} ${TRUNCATION_MESSAGE}`;
    }
    return message;
  }

  /**
   * Append message to output with optimized string operations
   */
  private appendMessageToOutput(output: string, message: string): string {
    if (output.length === 0) return message;
    if (output.endsWith('\n')) return `${output}${message}`;
    return `${output}\n${message}`;
  }
}
