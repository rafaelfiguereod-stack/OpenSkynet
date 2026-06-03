import { useEffect, useState, useRef } from 'react';
import { Send, Plus, Sparkles } from 'lucide-react';
import { useChatStore } from '@/stores/useChatStore';
import { getChatService } from '@/services/chatService';
import { Button } from '@/components/shared/Button';
import { Textarea } from '@/components/shared/Textarea';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { MessageBubble } from '@/components/agent/MessageBubble';
import { cn } from '@/lib/utils';

export function AgentPage() {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const activeConversation = useChatStore((state) => state.activeConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const setMessageStatus = useChatStore((state) => state.setMessageStatus);
  const appendToMessage = useChatStore((state) => state.appendToMessage);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (conversations.length === 0) {
      const conversation = createConversation('New Chat');
      selectConversation(conversation.id);
    } else if (!activeConversationId && conversations.length > 0) {
      selectConversation(conversations[0].id);
    }
  }, [conversations, activeConversationId, createConversation, selectConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeConversationId || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    addMessage(activeConversationId, {
      role: 'user',
      content: userMessage,
      status: 'done',
    });

    addMessage(activeConversationId, {
      role: 'assistant',
      content: '',
      status: 'streaming',
    });

    setIsStreaming(true);

    try {
      const chatService = getChatService();
      const messages = activeConversation?.messages || [];
      const lastMessage = messages[messages.length - 1];

      await chatService.sendMessage(
        activeConversationId,
        userMessage,
        {
          onChunk: (delta) => {
            if (lastMessage) {
              appendToMessage(activeConversationId, lastMessage.id, delta);
            }
          },
          onDone: () => {
            if (lastMessage) {
              setMessageStatus(activeConversationId, lastMessage.id, 'done');
            }
            setIsStreaming(false);
          },
          onError: (error) => {
            if (lastMessage) {
              setMessageStatus(activeConversationId, lastMessage.id, 'error');
              appendToMessage(activeConversationId, lastMessage.id, `\n\nError: ${error}`);
            }
            setIsStreaming(false);
          },
        }
      );
    } catch (error) {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    const conversation = createConversation('New Chat');
    selectConversation(conversation.id);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-black to-gray-800 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">OpenSkynet</h1>
            <p className="text-xs text-gray-500">AI Agent</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="shadow-sm hover:shadow-md transition-shadow"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="max-w-3xl mx-auto py-8 px-6 space-y-6">
          {activeConversation?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isStreaming && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-black rounded-full animate-pulse" />
                <span className="w-1 h-1 bg-black rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-1 h-1 bg-black rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
              <span>OpenSkynet is thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message OpenSkynet..."
              className="min-h-[56px] max-h-[200px] resize-none rounded-2xl border-gray-200 shadow-sm focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition-all"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="h-12 px-6 rounded-2xl bg-black text-white hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all active:scale-105"
            >
              {isStreaming ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                <span>Sending</span>
                </div>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
