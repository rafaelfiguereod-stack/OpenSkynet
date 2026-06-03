import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '@/stores/useChatStore';

describe('useChatStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useChatStore());
    act(() => {
      // Clear all conversations
      result.current.conversations.forEach((conv) => {
        result.current.deleteConversation(conv.id);
      });
    });
  });

  it('has initial state', () => {
    const { result } = renderHook(() => useChatStore());

    expect(result.current.conversations).toEqual([]);
    expect(result.current.activeConversationId).toBe(null);
    expect(result.current.activeConversation).toBeNull();
  });

  it('creates a new conversation', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      const conversation = result.current.createConversation('Test Chat');
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0]!.title).toBe('Test Chat');
    expect(result.current.activeConversationId).toBe(result.current.conversations[0]!.id);
  });

  it('selects conversation', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Chat 1');
    });

    const firstId = result.current.conversations[0]!.id;

    act(() => {
      result.current.createConversation('Chat 2');
    });

    const secondId = result.current.conversations[1]!.id;

    act(() => {
      result.current.selectConversation(firstId);
    });

    expect(result.current.activeConversationId).toBe(firstId);
  });

  it('deletes conversation', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      const conversation = result.current.createConversation('Test Chat');
      result.current.deleteConversation(conversation.id);
    });

    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.activeConversationId).toBeNull();
  });

  it('updates conversation title', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      const conversation = result.current.createConversation('Old Title');
      result.current.updateConversationTitle(conversation.id, 'New Title');
    });

    expect(result.current.conversations[0]!.title).toBe('New Title');
  });

  it('adds message to conversation', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      const conversation = result.current.createConversation('Test Chat');
      result.current.addMessage(conversation.id, {
        role: 'user',
        content: 'Hello',
        status: 'done',
      });
    });

    expect(result.current.conversations[0]!.messages).toHaveLength(1);
    expect(result.current.conversations[0]!.messages[0]!.content).toBe('Hello');
    expect(result.current.conversations[0]!.messages[0]!.role).toBe('user');
  });

  it('appends content to message', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      const conversation = result.current.createConversation('Test Chat');
      const msgId = crypto.randomUUID();

      // Add a message manually to get its ID
      act(() => {
        result.current.addMessage(conversation.id, {
          role: 'assistant',
          content: 'Hello',
          status: 'streaming',
        });
      });

      const messageId = result.current.conversations[0]!.messages[0]!.id;

      act(() => {
        result.current.appendToMessage(conversation.id, messageId, ' World');
      });
    });

    expect(result.current.conversations[0]!.messages[0]!.content).toBe('Hello World');
  });

  it('sets message status', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      const conversation = result.current.createConversation('Test Chat');
      result.current.addMessage(conversation.id, {
        role: 'user',
        content: 'Test',
        status: 'streaming',
      });
    });

    const messageId = result.current.conversations[0]!.messages[0]!.id;

    act(() => {
      result.current.setMessageStatus(conversation.id, messageId, 'done');
    });

    expect(result.current.conversations[0]!.messages[0]!.status).toBe('done');
  });
});
