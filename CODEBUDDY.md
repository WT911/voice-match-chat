# 智能聊天演示

一个展示 CodeBuddy Agent SDK 的简洁聊天应用。

## 架构

- **前端**：React + Vite + Tailwind CSS
- **后端**：Node.js + Express + WebSocket (ws)
- **智能体**：CodeBuddy Agent SDK 直接集成在服务端

## 运行应用

```bash
cd chat-demo
npm install
npm run dev
```

这将同时启动：
- 后端服务 http://localhost:3001
- Vite 开发服务器 http://localhost:5173

访问 http://localhost:5173

## 项目结构

```
chat-demo/
├── client/                    # React 前端
│   ├── App.tsx               # 主应用组件
│   ├── index.tsx             # 入口文件
│   ├── index.html            # HTML 模板
│   ├── globals.css           # Tailwind CSS
│   ├── components/
│   │   ├── ChatList.tsx      # 左侧对话列表
│   │   └── ChatWindow.tsx    # 主聊天界面
│   └── hooks/
│       └── useWebSocket.ts   # WebSocket 钩子
├── server/
│   ├── server.ts             # Express 服务器（REST + WebSocket）
│   ├── ai-client.ts          # CodeBuddy Agent SDK 封装
│   ├── session.ts            # 聊天会话管理
│   ├── chat-store.ts         # 内存存储
│   └── types.ts              # TypeScript 类型
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## API 接口

### REST API

- `GET /api/chats` - 获取所有对话
- `POST /api/chats` - 创建新对话
- `GET /api/chats/:id` - 获取对话详情
- `DELETE /api/chats/:id` - 删除对话
- `GET /api/chats/:id/messages` - 获取对话消息

### WebSocket (`ws://localhost:3001/ws`)

**客户端 -> 服务端：**
- `{ type: "subscribe", chatId: string }` - 订阅对话
- `{ type: "chat", chatId: string, content: string }` - 发送消息

**服务端 -> 客户端：**
- `{ type: "connected" }` - 连接已建立
- `{ type: "history", messages: [...] }` - 历史消息
- `{ type: "assistant_message", content: string }` - AI 回复
- `{ type: "tool_use", toolName: string, toolInput: {...} }` - 工具调用
- `{ type: "result", success: boolean }` - 查询完成
- `{ type: "error", error: string }` - 发生错误

## 注意事项

- 使用内存存储（重启后数据丢失）
- 智能体可使用的工具：Bash、Read、Write、Edit、Glob、Grep、WebSearch、WebFetch
- 前端使用 Vite 开发，支持热重载
- 后端使用 tsx 执行 TypeScript
