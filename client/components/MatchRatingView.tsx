import React, { useState } from "react";

interface PeerInfo {
  nickname: string;
  gender: "male" | "female";
  level: number;
}

interface MatchRatingViewProps {
  peer: PeerInfo;
  experienceGained: number;
  onSubmit: (score: number, tags: string[], comment?: string) => void;
  onSkip: () => void;
}

const QUICK_TAGS = ["友好", "有趣", "耐心", "健谈", "礼貌", "幽默", "温柔", "开朗"];

export function MatchRatingView({ peer, experienceGained, onSubmit, onSkip }: MatchRatingViewProps) {
  const [score, setScore] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-sm mx-auto">
      <div className="text-5xl mb-4">⭐</div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">通话结束</h2>
      <p className="text-sm text-gray-500 mb-6">
        你和 <span className="font-medium text-gray-700">{peer.nickname}</span> 的通话已结束
      </p>

      {experienceGained > 0 && (
        <div className="bg-purple-50 text-purple-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
          +{experienceGained} XP
        </div>
      )}

      {/* Star rating */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-3 text-center">为这次通话评分</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setScore(star)}
              className={`text-3xl transition-all ${star <= score ? "scale-110" : "opacity-30 grayscale"}`}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      {/* Quick tags */}
      <div className="mb-4 w-full">
        <p className="text-sm text-gray-500 mb-2 text-center">选择标签</p>
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedTags.includes(tag)
                  ? "bg-purple-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="添加评语（可选）"
        rows={2}
        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none mb-4"
      />

      {/* Submit */}
      <button
        onClick={() => onSubmit(score || 3, selectedTags, comment)}
        className="w-full py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-all mb-2"
      >
        提交评价
      </button>
      <button onClick={onSkip} className="text-sm text-gray-400 hover:text-gray-600">
        跳过评价
      </button>
    </div>
  );
}
