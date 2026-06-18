import { useState, useCallback, useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

interface UseMessagesOptions {
  wsUrl: string;
  onRefreshChats?: () => void;
}

export function useMessages({ wsUrl, onRefreshChats }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const subscribedChatRef = useRef<string | null>(null);

  const handleWSMessage = useCallback((message: any) => {
    switch (message.type) {
      case "connected":
        console.log("Connected to server");
        break;

      case "history":
        setMessages(message.messages || []);
        break;

      case "user_message":
        // User message already added locally
        break;

      case "assistant_message":
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: message.content,
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
        break;

      case "tool_use":
        setMessages((prev) => [
          ...prev,
          {
            id: message.toolId,
            role: "tool_use",
            content: "",
            timestamp: new Date().toISOString(),
            toolName: message.toolName,
            toolInput: message.toolInput,
          },
        ]);
        break;

      case "result":
        setIsLoading(false);
        onRefreshChats?.();
        break;

      case "error":
        console.error("Server error:", message.error);
        setIsLoading(false);
        break;
    }
  }, [onRefreshChats]);

  const { sendJsonMessage, readyState, lastJsonMessage } = useWebSocket(wsUrl, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  const isConnected = readyState === ReadyState.OPEN;

  useEffect(() => {
    if (lastJsonMessage) {
      handleWSMessage(lastJsonMessage);
    }
  }, [lastJsonMessage, handleWSMessage]);

  const subscribeToChat = useCallback((chatId: string) => {
    setMessages([]);
    setIsLoading(false);
    subscribedChatRef.current = chatId;
    sendJsonMessage({ type: "subscribe", chatId });
  }, [sendJsonMessage]);

  const sendMessage = useCallback((chatId: string, content: string) => {
    if (!chatId || !isConnected) return false;

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      },
    ]);

    setIsLoading(true);
    sendJsonMessage({ type: "chat", content, chatId });
    return true;
  }, [isConnected, sendJsonMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    subscribedChatRef.current = null;
  }, []);

  return {
    messages,
    isLoading,
    isConnected,
    subscribeToChat,
    sendMessage,
    clearMessages,
  };
}
