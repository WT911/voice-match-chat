-- ============================================
-- Chat-App 生产数据库 Schema (PostgreSQL)
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 用户表 (微信登录)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wechat_openid VARCHAR(128) UNIQUE NOT NULL,
  wechat_unionid VARCHAR(128) UNIQUE,
  nickname VARCHAR(64) NOT NULL DEFAULT '',
  avatar_url VARCHAR(512) DEFAULT '',
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  tags TEXT[] DEFAULT '{}',
  zodiac VARCHAR(16) DEFAULT '',
  voice_intro TEXT DEFAULT '',
  avatar_id INT DEFAULT 1,
  level INT DEFAULT 0,
  experience INT DEFAULT 0,
  price_per_minute INT DEFAULT 0,
  total_earnings INT DEFAULT 0,
  blacklist UUID[] DEFAULT '{}',
  -- 统计
  total_matches INT DEFAULT 0,
  total_call_duration INT DEFAULT 0,
  total_ratings INT DEFAULT 0,
  total_rating_score INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  last_match_date DATE,
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_wechat_openid ON users(wechat_openid);
CREATE INDEX idx_users_gender ON users(gender);

-- ============================================
-- 聊天会话表
-- ============================================
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(256) NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_updated_at ON chats(updated_at DESC);

-- ============================================
-- 聊天消息表
-- ============================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL CHECK (role IN ('user', 'assistant', 'tool_use', 'system')),
  content TEXT NOT NULL DEFAULT '',
  tool_name VARCHAR(64),
  tool_input JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_chat_id ON chat_messages(chat_id, created_at);

-- ============================================
-- 通话记录表
-- ============================================
CREATE TABLE call_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id VARCHAR(64) NOT NULL,
  caller_id UUID REFERENCES users(id) ON DELETE CASCADE,
  peer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  peer_nickname VARCHAR(64) NOT NULL DEFAULT '',
  peer_gender VARCHAR(10),
  peer_avatar_id INT DEFAULT 1,
  peer_level INT DEFAULT 0,
  call_duration INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  my_rating INT CHECK (my_rating >= 1 AND my_rating <= 5),
  unlimited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_records_caller ON call_records(caller_id, created_at DESC);
CREATE INDEX idx_call_records_match ON call_records(match_id);

-- ============================================
-- 匹配评分表
-- ============================================
CREATE TABLE match_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id VARCHAR(64) NOT NULL,
  rater_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INT CHECK (score >= 1 AND score <= 5),
  tags TEXT[] DEFAULT '{}',
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ratings_match ON match_ratings(match_id);
CREATE INDEX idx_ratings_target ON match_ratings(target_id);

-- ============================================
-- 微信登录状态表
-- ============================================
CREATE TABLE wechat_auth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(128) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_wechat_state ON wechat_auth_states(state);

-- ============================================
-- 刷新 Token 表
-- ============================================
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================
-- 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
