import React from "react";

interface LevelDisplayProps {
  level: number;
  experience: number;
  compact?: boolean;
}

const LEVELS = [
  { name: "青铜", icon: "🥉", color: "bg-amber-700", textColor: "text-amber-700", bgLight: "bg-amber-50" },
  { name: "白银", icon: "🥈", color: "bg-gray-400", textColor: "text-gray-500", bgLight: "bg-gray-50" },
  { name: "黄金", icon: "🥇", color: "bg-yellow-500", textColor: "text-yellow-600", bgLight: "bg-yellow-50" },
  { name: "铂金", icon: "💎", color: "bg-cyan-400", textColor: "text-cyan-500", bgLight: "bg-cyan-50" },
  { name: "钻石", icon: "👑", color: "bg-blue-500", textColor: "text-blue-600", bgLight: "bg-blue-50" },
  { name: "王者", icon: "🏆", color: "bg-purple-500", textColor: "text-purple-600", bgLight: "bg-purple-50" },
  { name: "传奇", icon: "🌟", color: "bg-orange-500", textColor: "text-orange-600", bgLight: "bg-orange-50" },
];

const LEVEL_XP = [0, 100, 300, 600, 1200, 2500, 5000, 99999];

function getProgress(exp: number) {
  let currentLevel = 0;
  for (let i = 6; i >= 0; i--) {
    if (exp >= LEVEL_XP[i]) {
      currentLevel = i;
      break;
    }
  }
  const currentXP = LEVEL_XP[currentLevel];
  const nextXP = LEVEL_XP[currentLevel + 1];
  const progress = nextXP > currentXP ? Math.min(100, Math.round(((exp - currentXP) / (nextXP - currentXP)) * 100)) : 100;
  return { currentLevel, currentXP, nextXP, progress };
}

export function LevelDisplay({ level, experience, compact = false }: LevelDisplayProps) {
  const info = LEVELS[level] || LEVELS[0];
  const { currentXP, nextXP, progress } = getProgress(experience);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{info.icon}</span>
        <span className={`text-sm font-medium ${info.textColor}`}>{info.name}</span>
        <span className="text-xs text-gray-400">Lv.{level}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-4 ${info.bgLight} border border-gray-100`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{info.icon}</span>
          <div>
            <p className={`text-lg font-bold ${info.textColor}`}>{info.name}</p>
            <p className="text-xs text-gray-400">等级 {level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">{experience} XP</p>
          <p className="text-xs text-gray-400">
            {level < 6 ? `距离下一级还需 ${nextXP - experience} XP` : "已达最高等级"}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${info.color}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">{currentXP} XP</span>
        <span className="text-xs text-gray-400">{nextXP} XP</span>
      </div>
    </div>
  );
}
