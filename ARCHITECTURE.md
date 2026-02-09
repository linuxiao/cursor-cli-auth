# Cursor CLI Auth 工作原理和数据流

## 工作原理概述

`cursor-cli-auth` 插件通过 **CLI Backend** 机制将 Cursor CLI (`agent` 命令) 集成到 OpenClaw 中。它不是直接调用 HTTP API，而是通过执行本地 CLI 命令来与 Cursor 服务交互。

## 核心概念

### CLI Backend 机制

OpenClaw 支持两种模型提供者：

1. **HTTP API 提供者**：直接调用 HTTP API（如 OpenAI、Anthropic）
2. **CLI Backend 提供者**：通过执行本地 CLI 命令（如 `claude`、`agent`）

`cursor-cli-auth` 使用第二种方式，将 `agent` 命令配置为 CLI Backend。

## 数据流

### 阶段 1: 插件注册和配置

**文件**: `extensions/cursor-cli-auth/index.ts`

1. 用户运行认证命令：
   ```bash
   openclaw models auth login --provider cursor-cli --method api-key
   ```

2. 插件执行认证流程：
   - 尝试从 Cursor CLI (`agent login`) 自动提取 API Key（从 macOS Keychain）
   - 如果失败，提示用户手动输入
   - 将 API Key 保存到 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

3. 插件注册 CLI Backend 配置：
   ```typescript
   configPatch: {
     agents: {
       defaults: {
         cliBackends: {
           "cursor-cli": {
             command: "agent",  // 或完整路径
             args: ["--print", "--output-format", "json"],
             resumeArgs: ["--print", "--output-format", "json", "--resume", "{sessionId}"],
             output: "json",
             input: "arg",
             modelArg: "--model",
             modelAliases: { "composer-1": "composer-1", ... },
             sessionArg: "--resume",
             sessionMode: "existing",
             // ...
           }
         }
       }
     }
   }
   ```

### 阶段 2: 模型选择

**文件**: `src/agents/model-selection.ts`

当用户发送消息时，OpenClaw 解析模型标识符（如 `cursor-cli/composer-1`）：

1. 提取 provider: `cursor-cli`
2. 提取 model: `composer-1`
3. 调用 `isCliProvider("cursor-cli", config)` 检查是否为 CLI Provider
4. 如果是 CLI Provider，路由到 `runCliAgent` 而不是 HTTP API

### 阶段 3: CLI 命令构建

**文件**: `src/agents/cli-runner.ts`, `src/agents/cli-runner/helpers.ts`

`runCliAgent` 函数执行以下步骤：

1. **解析 CLI Backend 配置**：
   ```typescript
   const backendResolved = resolveCliBackendConfig("cursor-cli", config);
   // 返回配置：{ command: "agent", args: [...], modelArg: "--model", ... }
   ```

2. **构建系统提示**：
   - 包含 OpenClaw 的系统提示
   - 包含工作区上下文
   - 包含文档路径

3. **处理会话 ID**：
   - 如果是新会话：生成新的 sessionId
   - 如果是继续会话：使用存储的 sessionId
   - 根据 `sessionMode: "existing"` 决定是否发送 sessionId

4. **构建命令行参数**：
   ```typescript
   const args = buildCliArgs({
     backend,
     baseArgs: ["--print", "--output-format", "json"],
     modelId: "composer-1",  // 经过 modelAliases 映射
     sessionId: "xxx-xxx-xxx",
     systemPrompt: "...",
     promptArg: "用户的消息",
   });
   // 结果: ["--print", "--output-format", "json", "--model", "composer-1", "--resume", "xxx-xxx-xxx", "用户的消息"]
   ```

5. **准备环境变量**：
   - 清除 `CURSOR_API_KEY`（避免冲突）
   - API Key 已通过 `agent login` 存储在 Keychain 中，`agent` 命令会自动使用

### 阶段 4: 执行 CLI 命令

**文件**: `src/agents/cli-runner.ts` (line 221)

```typescript
const result = await runCommandWithTimeout(
  [backend.command, ...args],  // ["agent", "--print", "--output-format", "json", "--model", "composer-1", "--resume", "sessionId", "用户消息"]
  {
    timeoutMs: params.timeoutMs,
    cwd: workspaceDir,
    env: env,  // 已清除 CURSOR_API_KEY
    input: stdinPayload,  // 如果 prompt 太长，通过 stdin 传递
  }
);
```

实际执行的命令示例：
```bash
agent --print --output-format json --model composer-1 --resume <sessionId> "用户的消息"
```

### 阶段 5: 解析输出

**文件**: `src/agents/cli-runner.ts` (line 228-280)

1. **读取 stdout/stderr**：
   ```typescript
   const stdout = result.stdout.trim();
   const stderr = result.stderr.trim();
   ```

2. **解析 JSON 输出**（因为 `output: "json"`）：
   ```typescript
   const parsed = parseCliJson(stdout, backend);
   // 提取：
   // - text: 助手回复的文本
   // - sessionId: 从 JSON 字段中提取（chatId, session_id, conversation_id）
   ```

3. **提取会话 ID**：
   - 从 JSON 响应的 `chatId`、`session_id` 或 `conversation_id` 字段提取
   - 存储到 session 文件中，用于后续对话

4. **返回结果**：
   ```typescript
   return {
     text: parsed.text,  // 助手回复
     sessionId: parsed.sessionId,  // 用于下次对话
     // ...
   };
   ```

### 阶段 6: 结果返回和会话管理

**文件**: `src/commands/agent.ts`

1. **返回结果给用户**：通过 Gateway WebSocket 发送到前端
2. **保存会话 ID**：将提取的 sessionId 保存到 session 文件
3. **下次对话**：使用保存的 sessionId，通过 `--resume` 参数继续对话

## 完整数据流图

```
用户发送消息
    ↓
OpenClaw 解析模型: cursor-cli/composer-1
    ↓
isCliProvider("cursor-cli") → true
    ↓
runCliAgent({
  provider: "cursor-cli",
  model: "composer-1",
  prompt: "用户消息",
  cliSessionId: "上次保存的 sessionId"
})
    ↓
resolveCliBackendConfig("cursor-cli")
    ↓ 返回配置
{
  command: "agent",
  args: ["--print", "--output-format", "json"],
  modelArg: "--model",
  sessionArg: "--resume",
  ...
}
    ↓
buildCliArgs() 构建命令行参数
    ↓
["agent", "--print", "--output-format", "json", 
 "--model", "composer-1", 
 "--resume", "<sessionId>", 
 "用户消息"]
    ↓
runCommandWithTimeout() 执行命令
    ↓
agent 命令执行（使用 Keychain 中的 API Key）
    ↓
agent 命令返回 JSON:
{
  "text": "助手回复",
  "chatId": "xxx-xxx-xxx"
}
    ↓
parseCliJson() 解析输出
    ↓
提取 text 和 sessionId
    ↓
返回结果给用户
    ↓
保存 sessionId 到 session 文件
```

## 关键配置说明

### cursor-cli-auth 插件配置

**位置**: `extensions/cursor-cli-auth/index.ts` (line 108-153)

```typescript
cliBackends: {
  "cursor-cli": {
    command: "agent",  // CLI 命令名称
    args: ["--print", "--output-format", "json"],  // 基础参数
    resumeArgs: ["--print", "--output-format", "json", "--resume", "{sessionId}"],
    output: "json",  // 输出格式：JSON
    input: "arg",  // 输入方式：命令行参数
    modelArg: "--model",  // 模型参数标志
    modelAliases: {  // 模型名称映射
      "composer-1": "composer-1",
      "gpt-5.2": "gpt-5.2",
      // ...
    },
    sessionArg: "--resume",  // 会话参数标志
    sessionMode: "existing",  // 只在有现有会话时发送 sessionId
    sessionIdFields: ["chatId", "session_id", "conversation_id"],  // 从 JSON 中提取 sessionId 的字段
    clearEnv: ["CURSOR_API_KEY"],  // 清除环境变量，避免冲突
    serialize: true,  // 串行执行（同一时间只执行一个命令）
  }
}
```

## 为什么使用 CLI Backend 而不是 HTTP API？

1. **认证简化**：`agent` 命令已经通过 `agent login` 配置了 API Key（存储在 Keychain），无需在 OpenClaw 中管理
2. **会话管理**：`agent` 命令内置会话管理，通过 `--resume` 参数自动处理
3. **统一接口**：所有 Cursor CLI 功能（模型、会话、工具等）都通过统一的 CLI 接口访问
4. **本地执行**：CLI 命令在本地执行，可以访问本地文件系统和工作区

## API Key 的使用

虽然插件保存了 API Key 到 `auth-profiles.json`，但实际执行时：

1. **环境变量被清除**：`clearEnv: ["CURSOR_API_KEY"]` 确保不使用环境变量
2. **使用 Keychain**：`agent` 命令从 macOS Keychain 读取 API Key（通过 `agent login` 设置）
3. **避免冲突**：清除环境变量确保使用 Keychain 中的凭证，而不是环境变量

## 会话连续性

1. **首次对话**：不发送 `--resume` 参数，`agent` 命令创建新会话
2. **提取 sessionId**：从 JSON 响应的 `chatId` 字段提取
3. **保存 sessionId**：存储到 OpenClaw 的 session 文件
4. **后续对话**：使用保存的 sessionId，通过 `--resume <sessionId>` 继续对话
5. **会话模式**：`sessionMode: "existing"` 确保只在有现有会话时才发送 sessionId

## 相关文件

- `extensions/cursor-cli-auth/index.ts` - 插件主文件，注册 CLI Backend 配置
- `extensions/cursor-cli-auth/cli-credentials.ts` - 从 Keychain 读取凭证
- `src/agents/cli-runner.ts` - CLI 命令执行逻辑
- `src/agents/cli-runner/helpers.ts` - CLI 参数构建和输出解析
- `src/agents/cli-backends.ts` - CLI Backend 配置解析
- `src/agents/model-selection.ts` - 模型选择逻辑（检测 CLI Provider）
- `docs/gateway/cli-backends.md` - CLI Backend 机制文档
