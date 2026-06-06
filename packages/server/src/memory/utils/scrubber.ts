/**
 * StreamingContextScrubber — strips <memory-context> blocks from LLM output
 * to prevent provider context from leaking to the user.
 */

const CONTEXT_TAG_RE = /<memory-context>.*?<\/memory-context>/gis;

export function scrubMemoryTags(text: string): string {
  return text.replace(CONTEXT_TAG_RE, "").trim();
}

export class StreamingContextScrubber {
  private _buffer = "";
  private _inTag = false;

  /**
   * Feed a chunk of text to the scrubber.
   * Returns the scrubbed portion of the chunk.
   */
  feed(chunk: string): string {
    this._buffer += chunk;
    const resultParts: string[] = [];

    while (this._buffer) {
      if (this._inTag) {
        const closeIdx = this._buffer.indexOf("</memory-context>");
        if (closeIdx === -1) {
          // Check for partial closing tag
          const partialCloseMatch = this._buffer.match(/<\/memor|<\/memory|<\/memory-|<\/memory-c|<\/memory-co|<\/memory-con|<\/memory-cont|<\/memory-contex|<\/memory-context|<\/memory-context>$/);
          if (partialCloseMatch) {
            // Keep partial closing tag in buffer
            break;
          }
          // No partial closing tag found, clear buffer and break
          this._buffer = "";
          break;
        }
        this._buffer = this._buffer.slice(closeIdx + "</memory-context>".length);
        this._inTag = false;
        continue;
      }

      const openIdx = this._buffer.indexOf("<memory-context>");
      if (openIdx === -1) {
        // Check for partial opening tag at the end
        // Find if there's a '<' that might start a tag
        const lastOpenAngle = this._buffer.lastIndexOf("<");
        if (lastOpenAngle !== -1) {
          const potentialTag = this._buffer.slice(lastOpenAngle);
          // Check if this could be the start of <memory-context>
          if (potentialTag.match(/^<mem(|o|or|ory|ory-|ory-c|ory-co|ory-con|ory-cont|ory-contex|ory-context)$/)) {
            // Keep partial opening tag in buffer
            resultParts.push(this._buffer.slice(0, lastOpenAngle));
            this._buffer = potentialTag;
            break;
          }
        }
        // No partial tag, output entire buffer as safe
        const safe = this._buffer;
        this._buffer = "";
        resultParts.push(safe);
      } else {
        resultParts.push(this._buffer.slice(0, openIdx));
        this._buffer = this._buffer.slice(openIdx);
        this._inTag = true;
      }
    }

    return resultParts.join("");
  }

  /**
   * Flush any remaining buffer content.
   * This should be called at the end of a stream.
   */
  flush(): string {
    const remaining = this._buffer;
    this._buffer = "";
    this._inTag = false;
    return remaining;
  }

  /**
   * Reset the scrubber state.
   */
  reset(): void {
    this._buffer = "";
    this._inTag = false;
  }

  /**
   * Scrub a complete text string (non-streaming).
   */
  static scrub(text: string): string {
    return scrubMemoryTags(text);
  }
}

/**
 * Create a transform stream for scrubbing memory context tags.
 * Useful for piping streaming responses.
 */
export class ScrubberTransformStream extends TransformStream<string, string> {
  constructor() {
    const scrubber = new StreamingContextScrubber();

    super({
      transform(chunk, controller) {
        const scrubbed = scrubber.feed(chunk);
        if (scrubbed) {
          controller.enqueue(scrubbed);
        }
      },

      flush(controller) {
        const remaining = scrubber.flush();
        if (remaining) {
          controller.enqueue(remaining);
        }
      },
    });
  }
}
