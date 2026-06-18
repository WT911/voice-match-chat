import { useState, useCallback } from "react";

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = "/api";

export function useChats(authToken?: string) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const authHeaders = authToken
    ? { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/chats`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChats(data);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    }
  }, [authToken]);

  const createChat = useCallback(async (): Promise<Chat | null> => {
    try {
      const res = await fetch(`${API_BASE}/chats`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const chat = await res.json();
      setChats((prev) => [chat, ...prev]);
      return chat;
    } catch (error) {
      console.error("Failed to create chat:", error);
      return null;
    }
  }, [authToken]);

  const deleteChat = useCallback(async (chatId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
      }
      return true;
    } catch (error) {
      console.error("Failed to delete chat:", error);
      return false;
    }
  }, [selectedChatId, authToken]);

  const selectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
  }, []);

  return {
    chats,
    selectedChatId,
    fetchChats,
    createChat,
    deleteChat,
    selectChat,
    setSelectedChatId,
  };
}
