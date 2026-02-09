# Cursor CLI Auth

OpenClaw 插件：为 [Cursor CLI](https://cursor.com) 提供 API Key 认证，使 OpenClaw 可通过 Cursor 的 `agent` 命令使用 Composer、GPT-5.2、Claude 等模型。

## 功能

- **API Key 认证**：自动从本机 Cursor CLI（`agent login`）读取凭证，或交互式输入
- **Provider**：在 OpenClaw 中注册 `cursor-cli` 模型提供商
- **CLI Backend**：通过执行本地 `agent` 命令与 Cursor 交互，不直接调用 HTTP API

## 依赖

- [OpenClaw](https://github.com/openclaw/openclaw)
- 已安装并登录的 Cursor CLI（`agent login`）

## 安装与启用

### 方式一：作为 OpenClaw 内置扩展（推荐）

若 OpenClaw 从源码或部署目录运行，且包含 `extensions/cursor-cli-auth`：

```bash
openclaw plugins enable cursor-cli-auth
```

重启 Gateway 后生效。

### 方式二：从本仓库安装到 OpenClaw

```bash
# 将插件安装到 ~/.openclaw/extensions/
openclaw plugins install https://github.com/linuxiao/cursor-cli-auth.git
openclaw plugins enable cursor-cli-auth
```

## 认证配置

### 使用 Cursor CLI 已有登录态

1. 在本机先用 Cursor CLI 登录：

   ```bash
   agent login
   ```

2. 在 OpenClaw 中配置并设为默认：

   ```bash
   openclaw models auth login --provider cursor-cli --method api-key --set-default
   ```

插件会尝试从 Cursor CLI 的 Keychain/凭证存储中读取 API Key；若读取失败，会提示你手动输入。

### 手动输入 API Key

若自动检测失败，按提示输入 Cursor API Key 即可。

## 支持的模型

| 模型 ID | 说明 |
|--------|------|
| `composer-1` | Composer 1（默认） |
| `gpt-5.2` | GPT-5.2 |
| `gpt-5.2-high` | GPT-5.2 High |
| `gpt-5.2-codex-high` | GPT-5.2 Codex High |
| `opus-4.6-thinking` | Claude 4.6 Opus (Thinking) |
| `sonnet-4.5` | Claude 4.5 Sonnet |
| `sonnet-4.5-thinking` | Claude 4.5 Sonnet (Thinking) |

最新列表以 Cursor 的 `agent models` 为准。

## 架构说明

插件通过 OpenClaw 的 **CLI Backend** 机制将 Cursor CLI 的 `agent` 命令注册为模型后端，数据流为：OpenClaw → 插件 → 本地 `agent` 命令 → Cursor 服务。详见仓库内 [ARCHITECTURE.md](./ARCHITECTURE.md)（若存在）。

## 常见问题

- **找不到 API Key**：先执行 `agent login`，或按提示手动输入 API Key。
- **认证失败**：确认 API Key 有效且具备相应权限。
- **启用后不生效**：重启 OpenClaw Gateway 后再试。

## 许可证

MIT
