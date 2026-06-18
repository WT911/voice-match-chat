import React, { useState, useEffect } from "react";
import { LevelDisplay } from "./LevelDisplay";
import type { CurrentUser, CallRecord } from "../hooks/useVoiceMatch";

interface ProfilePageProps {
  currentUser: CurrentUser | null;
  onLogout?: () => void;
  authNickname?: string;
}

const ANIMAL_AVATARS = [
  "🐶","🐱","🐼","🐨","🐰","🦊","🐸","🐵",
  "🐮","🐷","🐹","🐭","🐻","🦁","🐯","🐔",
  "🐧","🐦","🦄","🐙",
];

const ZODIAC_EMOJI: Record<string, string> = {
  "白羊座":"♈","金牛座":"♉","双子座":"♊","巨蟹座":"♋",
  "狮子座":"♌","处女座":"♍","天秤座":"♎","天蝎座":"♏",
  "射手座":"♐","摩羯座":"♑","水瓶座":"♒","双鱼座":"♓",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  if (m > 0) return `${m}分钟`;
  return `${seconds}秒`;
}

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}

export function ProfilePage({ currentUser, onLogout, authNickname }: ProfilePageProps) {
  const [showCallRecords, setShowCallRecords] = useState(false);
  const [liveUser, setLiveUser] = useState<CurrentUser | null>(currentUser);

  // 尝试从 REST API 获取最新用户数据
  useEffect(() => {
    if (!currentUser?.userId) return;

    fetch(`/api/voice-match/profile/${currentUser.userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.userId) {
          setLiveUser(data as CurrentUser);
        }
      })
      .catch(() => {
        // 静默降级，使用传入的 currentUser
      });
  }, [currentUser?.userId]);

  const user = liveUser || currentUser;

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">请先在语音匹配页面完成注册</p>
      </div>
    );
  }

  const avgRating =
    user.stats.totalRatings > 0
      ? (user.stats.totalRatingScore / user.stats.totalRatings).toFixed(1)
      : "-";

  const avatarEmoji = ANIMAL_AVATARS[(user.avatarId || 1) - 1] || "🐶";
  const callRecords: CallRecord[] = user.callRecords || [];

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto">
      {/* Header - 完整用户信息 */}
      <div className="bg-white px-6 pt-12 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-3xl shadow-md">
            {avatarEmoji}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800">{user.nickname}</h2>
            <p className="text-sm text-gray-500">
              {user.gender === "male" ? "男生" : "女生"}
              {user.zodiac && (
                <span> · {ZODIAC_EMOJI[user.zodiac] || ""} {user.zodiac}</span>
              )}
              <span className="ml-1">· ID: {user.userId.slice(0, 8)}</span>
            </p>
          </div>
        </div>

        {/* 兴趣标签 */}
        {user.tags && user.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {user.tags.map((t: string) => (
              <span key={t} className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-medium">
                {t}
              </span>
            ))}
          </div>
        )}

        <LevelDisplay level={user.level} experience={user.experience} />

        {/* 付费设置 */}
        {user.pricePerMinute > 0 && (
          <div className="mt-3 px-3 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs flex items-center gap-2">
            <span>💰</span>
            <span>收费 {user.pricePerMinute} 分/分钟</span>
          </div>
        )}
      </div>

      {/* 数据统计 */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 px-1">数据统计</h3>
        <div className="bg-white rounded-2xl divide-y divide-gray-50">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm text-gray-600">总匹配次数</span>
            <span className="text-sm font-bold text-gray-800">{user.stats.totalMatches}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm text-gray-600">总通话时长</span>
            <span className="text-sm font-bold text-gray-800">
              {formatDuration(user.stats.totalCallDuration)}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm text-gray-600">获得评价</span>
            <span className="text-sm font-bold text-gray-800">
              {user.stats.totalRatings} 次 · {avgRating} 分
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm text-gray-600">连续匹配</span>
            <span className="text-sm font-bold text-orange-500">
              🔥 {user.stats.currentStreak} 天
            </span>
          </div>
        </div>
      </div>

      {/* 通话记录 */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setShowCallRecords(!showCallRecords)}
          className="w-full flex items-center justify-between px-1 py-2"
        >
          <h3 className="text-sm font-semibold text-gray-500">
            通话记录 ({callRecords.length})
          </h3>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showCallRecords ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCallRecords && (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 mt-1">
            {callRecords.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                暂无通话记录
              </div>
            ) : (
              callRecords.slice().reverse().map((record: CallRecord) => (
                <div key={record.matchId} className="px-4 py-3 flex items-center gap-3">
                  <div className="text-2xl">
                    {ANIMAL_AVATARS[(record.peerAvatarId || 1) - 1] || "🐶"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {record.peerNickname}
                      <span className="text-xs text-gray-400 ml-1">
                        {record.peerGender === "male" ? "♂" : "♀"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(record.startedAt)} · 通话 {formatDuration(record.callDuration)}
                      {record.unlimited && <span className="text-green-500 ml-1">· 已解锁</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-medium ${
                      ["text-amber-700","text-gray-500","text-yellow-600","text-cyan-500","text-blue-600","text-purple-600","text-orange-600"][record.peerLevel] || "text-gray-500"
                    }`}>
                      Lv.{record.peerLevel}
                    </span>
                    {record.myRating && (
                      <p className="text-xs text-yellow-500 mt-0.5">{"⭐".repeat(record.myRating)}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 等级权益 */}
      <div className="px-4 pb-8">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 px-1">等级权益</h3>
        <div className="bg-white rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "🎤", label: "基础匹配", lv: 0 },
              { icon: "🖼️", label: "头像框", lv: 1 },
              { icon: "⚡", label: "优先匹配", lv: 2 },
              { icon: "💎", label: "昵称变色", lv: 3 },
              { icon: "👑", label: "隐身模式", lv: 4 },
              { icon: "🏆", label: "王者徽章", lv: 5 },
              { icon: "🌟", label: "传奇徽章", lv: 6 },
            ].map((item) => (
              <div
                key={item.lv}
                className={`text-center py-3 rounded-xl ${
                  user.level >= item.lv
                    ? "bg-purple-50 text-purple-600"
                    : "bg-gray-50 text-gray-300"
                }`}
              >
                <div className="text-xl mb-1">{item.icon}</div>
                <p className="text-xs">{item.label}</p>
                <p className="text-xs mt-0.5 opacity-70">
                  {user.level >= item.lv ? "已解锁" : `Lv.${item.lv}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      {onLogout && (
        <div className="px-4 pb-8">
          <button
            onClick={onLogout}
            className="w-full py-3 bg-white border border-red-200 text-red-500 rounded-2xl text-sm font-medium hover:bg-red-50 transition-all"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
