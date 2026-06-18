/**
 * 等级系统 - 管理 0-6 级配置和经验值计算
 */

import type { LevelConfig, LevelBenefit } from "./voice-match-types.js";

const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 0,
    name: "青铜",
    requiredXP: 0,
    icon: "🥉",
    color: "text-amber-700",
    benefits: [
      { id: "basic_match", name: "基础匹配", description: "参与语音匹配", type: "functional" },
    ],
  },
  {
    level: 1,
    name: "白银",
    requiredXP: 100,
    icon: "🥈",
    color: "text-gray-400",
    benefits: [
      { id: "basic_match", name: "基础匹配", description: "参与语音匹配", type: "functional" },
      { id: "basic_frame", name: "基础头像框", description: "白银专属头像框", type: "cosmetic" },
    ],
  },
  {
    level: 2,
    name: "黄金",
    requiredXP: 300,
    icon: "🥇",
    color: "text-yellow-500",
    benefits: [
      { id: "basic_match", name: "基础匹配", description: "参与语音匹配", type: "functional" },
      { id: "basic_frame", name: "基础头像框", description: "白银专属头像框", type: "cosmetic" },
      { id: "priority_match", name: "优先匹配", description: "匹配队列中获得优先权", type: "privilege" },
      { id: "gold_frame", name: "黄金头像框", description: "黄金专属头像框", type: "cosmetic" },
    ],
  },
  {
    level: 3,
    name: "铂金",
    requiredXP: 600,
    icon: "💎",
    color: "text-cyan-400",
    benefits: [
      { id: "basic_match", name: "基础匹配", description: "参与语音匹配", type: "functional" },
      { id: "basic_frame", name: "基础头像框", description: "白银专属头像框", type: "cosmetic" },
      { id: "priority_match", name: "优先匹配", description: "匹配队列中获得优先权", type: "privilege" },
      { id: "gold_frame", name: "黄金头像框", description: "黄金专属头像框", type: "cosmetic" },
      { id: "speed_match", name: "匹配加速", description: "匹配速度提升 30%", type: "privilege" },
      { id: "nick_color", name: "昵称变色", description: "昵称显示铂金专属颜色", type: "cosmetic" },
      { id: "call_effect", name: "通话特效", description: "通话界面专属粒子特效", type: "cosmetic" },
    ],
  },
  {
    level: 4,
    name: "钻石",
    requiredXP: 1200,
    icon: "👑",
    color: "text-blue-500",
    benefits: [
      { id: "basic_match", name: "基础匹配", description: "参与语音匹配", type: "functional" },
      { id: "basic_frame", name: "基础头像框", description: "白银专属头像框", type: "cosmetic" },
      { id: "priority_match", name: "优先匹配", description: "匹配队列中获得优先权", type: "privilege" },
      { id: "gold_frame", name: "黄金头像框", description: "黄金专属头像框", type: "cosmetic" },
      { id: "speed_match", name: "匹配加速", description: "匹配速度提升 30%", type: "privilege" },
      { id: "nick_color", name: "昵称变色", description: "昵称显示钻石专属颜色", type: "cosmetic" },
      { id: "call_effect", name: "通话特效", description: "通话界面专属粒子特效", type: "cosmetic" },
      { id: "vip_match", name: "极高优先匹配", description: "匹配队列中最高优先级", type: "privilege" },
      { id: "custom_avatar", name: "自定义头像", description: "可上传自定义头像", type: "cosmetic" },
      { id: "stealth_mode", name: "隐身模式", description: "可选择隐身匹配", type: "privilege" },
    ],
  },
  {
    level: 5,
    name: "王者",
    requiredXP: 2500,
    icon: "🏆",
    color: "text-purple-500",
    benefits: [
      { id: "basic_match", name: "基础匹配", description: "参与语音匹配", type: "functional" },
      { id: "basic_frame", name: "基础头像框", description: "白银专属头像框", type: "cosmetic" },
      { id: "priority_match", name: "优先匹配", description: "匹配队列中获得优先权", type: "privilege" },
      { id: "gold_frame", name: "黄金头像框", description: "黄金专属头像框", type: "cosmetic" },
      { id: "speed_match", name: "匹配加速", description: "匹配速度提升 30%", type: "privilege" },
      { id: "nick_color", name: "昵称变色", description: "昵称显示王者专属颜色", type: "cosmetic" },
      { id: "call_effect", name: "通话特效", description: "通话界面专属粒子特效", type: "cosmetic" },
      { id: "vip_match", name: "极高优先匹配", description: "匹配队列中最高优先级", type: "privilege" },
      { id: "custom_avatar", name: "自定义头像", description: "可上传自定义头像", type: "cosmetic" },
      { id: "stealth_mode", name: "隐身模式", description: "可选择隐身匹配", type: "privilege" },
      { id: "king_badge", name: "王者徽章", description: "资料页展示王者专属徽章", type: "cosmetic" },
      { id: "all_benefits", name: "全部权益", description: "解锁所有下级权益", type: "privilege" },
    ],
  },
  {
    level: 6,
    name: "传奇",
    requiredXP: 5000,
    icon: "🌟",
    color: "text-orange-500",
    benefits: [
      { id: "basic_match", name: "基础匹配", description: "参与语音匹配", type: "functional" },
      { id: "basic_frame", name: "基础头像框", description: "白银专属头像框", type: "cosmetic" },
      { id: "priority_match", name: "优先匹配", description: "匹配队列中获得优先权", type: "privilege" },
      { id: "gold_frame", name: "黄金头像框", description: "黄金专属头像框", type: "cosmetic" },
      { id: "speed_match", name: "匹配加速", description: "匹配速度提升 30%", type: "privilege" },
      { id: "nick_color", name: "昵称变色", description: "昵称显示传奇专属颜色", type: "cosmetic" },
      { id: "call_effect", name: "通话特效", description: "通话界面专属粒子特效", type: "cosmetic" },
      { id: "vip_match", name: "极高优先匹配", description: "匹配队列中最高优先级", type: "privilege" },
      { id: "custom_avatar", name: "自定义头像", description: "可上传自定义头像", type: "cosmetic" },
      { id: "stealth_mode", name: "隐身模式", description: "可选择隐身匹配", type: "privilege" },
      { id: "king_badge", name: "王者徽章", description: "资料页展示传奇专属徽章", type: "cosmetic" },
      { id: "all_benefits", name: "全部权益", description: "解锁所有下级权益", type: "privilege" },
      { id: "guaranteed_match", name: "匹配必成功", description: "超时自动扩展匹配范围直到成功", type: "privilege" },
      { id: "custom_bg", name: "自定义背景", description: "可自定义通话界面背景", type: "cosmetic" },
      { id: "stats_panel", name: "数据面板", description: "查看详细通话数据分析", type: "functional" },
    ],
  },
];

export class LevelSystem {
  getLevelConfig(level: number): LevelConfig {
    return LEVEL_CONFIGS[Math.min(level, 6)] || LEVEL_CONFIGS[0];
  }

  calculateLevel(experience: number): number {
    for (let i = 6; i >= 0; i--) {
      if (experience >= LEVEL_CONFIGS[i].requiredXP) {
        return i;
      }
    }
    return 0;
  }

  getProgress(experience: number): {
    currentLevel: number;
    currentXP: number;
    nextLevelXP: number;
    percentage: number;
    config: LevelConfig;
  } {
    const currentLevel = this.calculateLevel(experience);
    const config = this.getLevelConfig(currentLevel);
    const nextConfig = currentLevel < 6 ? this.getLevelConfig(currentLevel + 1) : null;

    const currentLevelXP = config.requiredXP;
    const nextLevelXP = nextConfig ? nextConfig.requiredXP : config.requiredXP;
    const xpInLevel = experience - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const percentage = nextConfig ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;

    return {
      currentLevel,
      currentXP: experience,
      nextLevelXP,
      percentage,
      config,
    };
  }

  /**
   * 计算通话获得的经验值
   */
  calculateCallExperience(callDurationSeconds: number, rating: number, isFirstMatchToday: boolean, streak: number): number {
    let xp = 0;
    // 通话时长：每秒 1 XP
    xp += callDurationSeconds;
    // 互评得分加成
    xp += rating * 10;
    // 每日首次匹配奖励
    if (isFirstMatchToday) xp += 20;
    // 连续天数奖励
    xp += streak * 5;
    return Math.round(xp);
  }

  /**
   * 检查是否升级
   */
  checkLevelUp(oldXP: number, newXP: number): {
    leveledUp: boolean;
    previousLevel: number;
    newLevel: number;
    experienceGained: number;
  } | null {
    const previousLevel = this.calculateLevel(oldXP);
    const newLevel = this.calculateLevel(newXP);
    const experienceGained = newXP - oldXP;

    if (newLevel > previousLevel) {
      return {
        leveledUp: true,
        previousLevel,
        newLevel,
        experienceGained,
      };
    }
    return null;
  }

  getAllConfigs(): LevelConfig[] {
    return LEVEL_CONFIGS;
  }
}

export const levelSystem = new LevelSystem();
