import { useEffect, useCallback, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { MessagePanel } from "./components/MessagePanel";
import { VoiceMatchPage } from "./components/VoiceMatchPage";
import { ProfilePage } from "./components/ProfilePage";
import { LoginPage } from "./components/LoginPage";
import { useChats } from "./hooks/useChats";
import { useMessages } from "./hooks/useMessages";

const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

type TabKey = "chat" | "voice" | "profile";

function TabBar({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  const tabs: { key: TabKey; label: string; icon: (active: boolean) => JSX.Element }[] = [
    {
      key: "chat",
      label: "聊天",
      icon: (active) => (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 1.5}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      key: "voice",
      label: "匹配",
      icon: (active) => (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 1.5}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      key: "profile",
      label: "我的",
      icon: (active) => (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-14 bg-white border-t border-gray-100 flex items-center justify-around">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
              active ? "text-blue-500" : "text-gray-400"
            }`}
          >
            {tab.icon(active)}
            <span className={`text-xs ${active ? "font-medium" : ""}`}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("chat");

  // ==========================================
  // 登录状态
  // ==========================================
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [authNickname, setAuthNickname] = useState("");

  // 检查本地登录状态
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const userId = localStorage.getItem("auth_user_id");
    const nickname = localStorage.getItem("auth_nickname");

    if (token && userId) {
      // 验证 token
      fetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) {
            setAuthToken(token);
            setAuthUserId(userId);
            setAuthNickname(nickname || "用户");
            setIsLoggedIn(true);
          } else {
            // Token 过期，清除
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_refresh_token");
            localStorage.removeItem("auth_user_id");
            localStorage.removeItem("auth_nickname");
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLoginSuccess = useCallback(
    (token: string, userId: string, nickname: string, _isNewUser: boolean) => {
      setAuthToken(token);
      setAuthUserId(userId);
      setAuthNickname(nickname);
      setIsLoggedIn(true);
    },
    []
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_refresh_token");
    localStorage.removeItem("auth_user_id");
    localStorage.removeItem("auth_nickname");
    setIsLoggedIn(false);
    setAuthToken("");
    setAuthUserId("");
    setAuthNickname("");
  }, []);

  // ==========================================
  // Chat hooks (带 auth token 的 WS URL)
  // ==========================================
  const wsUrlWithAuth = authToken ? `${WS_URL}?token=${authToken}` : WS_URL;

  const {
    chats,
    selectedChatId,
    fetchChats,
    createChat,
    deleteChat,
    selectChat,
    setSelectedChatId,
  } = useChats(authToken);

  const {
    messages,
    isLoading,
    isConnected,
    subscribeToChat,
    sendMessage,
    clearMessages,
  } = useMessages({
    wsUrl: wsUrlWithAuth,
    onRefreshChats: fetchChats,
  });

  const handleSelectChat = useCallback((chatId: string) => {
    selectChat(chatId);
    subscribeToChat(chatId);
  }, [selectChat, subscribeToChat]);

  const handleNewChat = useCallback(async () => {
    const chat = await createChat();
    if (chat) {
      handleSelectChat(chat.id);
    }
  }, [createChat, handleSelectChat]);

  const handleDeleteChat = useCallback(async (chatId: string) => {
    const deleted = await deleteChat(chatId);
    if (deleted && selectedChatId === chatId) {
      clearMessages();
    }
  }, [deleteChat, selectedChatId, clearMessages]);

  const handleSendMessage = useCallback((content: string) => {
    if (selectedChatId) {
      sendMessage(selectedChatId, content);
    }
  }, [selectedChatId, sendMessage]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchChats();
    }
  }, [isLoggedIn, fetchChats]);

  // Get voice match user from localStorage
  const getSavedVoiceUser = () => {
    try {
      const data = localStorage.getItem("voice_match_user");
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  };

  // ==========================================
  // 未登录 → 显示登录页
  // ==========================================
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "chat" && (
          <>
            <div className="w-64 shrink-0 hidden sm:block">
              <Sidebar
                chats={chats}
                selectedChatId={selectedChatId}
                onSelectChat={handleSelectChat}
                onNewChat={handleNewChat}
                onDeleteChat={handleDeleteChat}
              />
            </div>
            <MessagePanel
              chatId={selectedChatId}
              messages={messages}
              isConnected={isConnected}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
            />
            {!selectedChatId && (
              <div className="flex-1 flex sm:hidden items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30">
                <div className="text-center px-8">
                  <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">选择对话或创建新对话</p>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "voice" && (
          <VoiceMatchPage wsUrl={wsUrlWithAuth} />
        )}

        {activeTab === "profile" && (
          <ProfilePage
            currentUser={getSavedVoiceUser()}
            onLogout={handleLogout}
            authNickname={authNickname}
          />
        )}
      </div>

      {/* Bottom Tab Bar - 微信风格 */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
