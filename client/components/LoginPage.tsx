import React, { useState, useEffect } from "react";

interface LoginPageProps {
  onLoginSuccess: (token: string, userId: string, nickname: string, isNewUser: boolean) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [devOpenId, setDevOpenId] = useState("dev_user_001");

  // 检查是否从微信回调返回
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state) {
      handleWechatCallback(code, state);
    }

    // 检查本地是否已有 token
    const savedToken = localStorage.getItem("auth_token");
    const savedUserId = localStorage.getItem("auth_user_id");
    const savedNickname = localStorage.getItem("auth_nickname");

    if (savedToken && savedUserId) {
      // 验证 token 有效性
      fetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => {
          if (res.ok) {
            onLoginSuccess(savedToken, savedUserId, savedNickname || "用户", false);
          } else {
            // Token 过期，清除
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user_id");
            localStorage.removeItem("auth_nickname");
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleWechatCallback = async (code: string, state: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/wechat/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "登录失败");
      }

      const data = await res.json();
      saveAuth(data);
      onLoginSuccess(data.accessToken, data.user.userId, data.user.nickname, data.isNewUser);
    } catch (err: any) {
      setError(err.message || "微信登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleWechatLogin = () => {
    setLoading(true);
    setError("");

    // 获取微信登录 URL
    fetch("/api/auth/wechat/url?redirect=" + encodeURIComponent(window.location.origin + window.location.pathname))
      .then((res) => res.json())
      .then((data) => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("获取登录链接失败");
        }
      })
      .catch((err) => {
        setError(err.message || "获取登录链接失败");
        setLoading(false);
      });
  };

  // 开发环境模拟登录
  const handleDevLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openId: devOpenId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "登录失败");
      }

      const data = await res.json();
      saveAuth(data);
      onLoginSuccess(data.accessToken, data.user.userId, data.user.nickname, data.isNewUser);
    } catch (err: any) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const saveAuth = (data: any) => {
    localStorage.setItem("auth_token", data.accessToken);
    localStorage.setItem("auth_refresh_token", data.refreshToken);
    localStorage.setItem("auth_user_id", data.user.userId);
    localStorage.setItem("auth_nickname", data.user.nickname);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎤</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">语音匹配</h1>
          <p className="text-sm text-gray-500">遇见有趣的声音</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {/* 微信登录按钮 */}
        <button
          onClick={handleWechatLogin}
          disabled={loading}
          className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-200 mb-4"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18z"/>
            </svg>
          )}
          <span>{loading ? "登录中..." : "微信扫码登录"}</span>
        </button>

        {/* 开发环境模拟登录 */}
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => setShowDevLogin(!showDevLogin)}
            className="w-full text-xs text-gray-400 hover:text-gray-500 transition-colors"
          >
            {showDevLogin ? "收起" : "开发环境登录"}
          </button>

          {showDevLogin && (
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={devOpenId}
                onChange={(e) => setDevOpenId(e.target.value)}
                placeholder="输入模拟 OpenID"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button
                onClick={handleDevLogin}
                disabled={loading}
                className="w-full py-2.5 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-all disabled:opacity-50"
              >
                模拟登录
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          登录即表示同意服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
