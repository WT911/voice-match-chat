import React, { useState } from "react";

interface GenderSelectModalProps {
  onSelect: (data: {
    gender: "male" | "female";
    nickname: string;
    tags: string[];
    zodiac: string;
    avatarId: number;
  }) => void;
}

const ZODIAC_SIGNS = [
  "白羊座", "金牛座", "双子座", "巨蟹座",
  "狮子座", "处女座", "天秤座", "天蝎座",
  "射手座", "摩羯座", "水瓶座", "双鱼座",
];

const INTEREST_TAGS = [
  "音乐", "电影", "旅行", "美食", "运动", "游戏",
  "读书", "摄影", "宠物", "动漫", "科技", "时尚",
  "健身", "画画", "跳舞", "唱歌", "写作", "编程",
  "咖啡", "茶艺", "露营", "滑雪", "潜水", "瑜伽",
];

const ANIMAL_AVATARS = [
  "🐶", "🐱", "🐼", "🐨", "🐰", "🦊", "🐸", "🐵",
  "🐮", "🐷", "🐹", "🐭", "🐻", "🦁", "🐯", "🐔",
  "🐧", "🐦", "🦄", "🐙",
];

export function GenderSelectModal({ onSelect }: GenderSelectModalProps) {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [selectedGender, setSelectedGender] = useState<"male" | "female" | null>(null);
  const [selectedZodiac, setSelectedZodiac] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [error, setError] = useState("");

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
    setError("");
  };

  const handleNext = () => {
    setError("");
    if (step === 1) {
      if (!nickname.trim()) { setError("请输入昵称"); return; }
      if (nickname.trim().length > 12) { setError("昵称最多12个字符"); return; }
      if (!selectedGender) { setError("请选择性别"); return; }
      setStep(2);
    } else if (step === 2) {
      if (!selectedZodiac) { setError("请选择星座"); return; }
      if (selectedTags.length === 0) { setError("请至少选择1个兴趣标签"); return; }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError("");
    setStep((s) => s - 1);
  };

  const handleConfirm = () => {
    onSelect({
      gender: selectedGender!,
      nickname: nickname.trim(),
      tags: selectedTags,
      zodiac: selectedZodiac,
      avatarId: selectedAvatar + 1,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-gray-50">
          <div className="text-4xl mb-2">🎤</div>
          <h2 className="text-lg font-bold text-gray-800">完善你的资料</h2>
          <p className="text-xs text-gray-400 mt-1">资料选择后不可更改</p>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-all ${
                  s === step ? "bg-purple-500 w-6" : s < step ? "bg-purple-300" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[400px] overflow-y-auto">
          {/* Step 1: Nickname + Gender */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setError(""); }}
                  placeholder="取个好听的名字"
                  maxLength={12}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">性别</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setSelectedGender("male"); setError(""); }}
                    className={`py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      selectedGender === "male"
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-gray-200 hover:border-blue-200 text-gray-500"
                    }`}
                  >
                    <span className="text-3xl">👨</span>
                    <span className="text-sm font-medium">男生</span>
                  </button>
                  <button
                    onClick={() => { setSelectedGender("female"); setError(""); }}
                    className={`py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      selectedGender === "female"
                        ? "border-pink-500 bg-pink-50 text-pink-600"
                        : "border-gray-200 hover:border-pink-200 text-gray-500"
                    }`}
                  >
                    <span className="text-3xl">👩</span>
                    <span className="text-sm font-medium">女生</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Zodiac + Tags */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">星座</label>
                <div className="grid grid-cols-4 gap-2">
                  {ZODIAC_SIGNS.map((z) => (
                    <button
                      key={z}
                      onClick={() => { setSelectedZodiac(z); setError(""); }}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        selectedZodiac === z
                          ? "border-purple-500 bg-purple-50 text-purple-600"
                          : "border-gray-100 bg-gray-50 text-gray-500 hover:border-purple-200"
                      }`}
                    >
                      {z.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  兴趣标签 <span className="text-xs text-gray-400">({selectedTags.length}/5)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        selectedTags.includes(tag)
                          ? "bg-purple-500 text-white shadow-sm"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Avatar */}
          {step === 3 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">选择头像</label>
              <div className="grid grid-cols-5 gap-3">
                {ANIMAL_AVATARS.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedAvatar(i); setError(""); }}
                    className={`aspect-square rounded-xl flex items-center justify-center text-2xl transition-all ${
                      selectedAvatar === i
                        ? "bg-purple-100 ring-2 ring-purple-500 scale-110"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-xs text-center mt-4">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
            >
              上一步
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-all"
            >
              下一步
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-all"
            >
              确认并开始
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
