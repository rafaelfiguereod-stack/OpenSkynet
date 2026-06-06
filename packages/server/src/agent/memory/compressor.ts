type Message = { role: string; content: string };

export class ContextCompressor {
  compress(messages: Message[], maxTokens: number): Message[] {
    if (messages.length === 0) return [];

    const estimateTokens = (text: string): number =>
      Math.ceil(text.length / 4);

    let totalTokens = 0;
    for (const msg of messages) {
      totalTokens += estimateTokens(msg.content);
    }

    if (totalTokens <= maxTokens) return messages;

    const result: Message[] = [];
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    for (const sys of systemMessages) {
      result.push(sys);
    }

    if (nonSystem.length <= 3) return [...result, ...nonSystem];

    const keepLast = 4;
    const tail = nonSystem.slice(-keepLast);
    const middle = nonSystem.slice(0, -keepLast);

    const summaryParts: string[] = [];
    for (const msg of middle) {
      const prefix = msg.role === "user" ? "User" : "Assistant";
      const snippet =
        msg.content.length > 200
          ? msg.content.slice(0, 200) + "..."
          : msg.content;
      summaryParts.push(`${prefix}: ${snippet}`);
    }

    result.push({
      role: "system",
      content: `[Earlier conversation summarized]\n${summaryParts.join("\n")}`,
    });

    result.push(...tail);

    return result;
  }
}
