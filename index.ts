import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { readCursorCliCredentials } from "./cli-credentials.js";

const PROVIDER_ID = "cursor-cli";
const PROVIDER_LABEL = "Cursor CLI";
const DEFAULT_MODEL = "cursor-cli/composer-1"; // 默认使用 Composer 1

/**
 * Cursor CLI 认证插件
 * 
 * 支持 API Key 认证方式：
 * 1. 自动从 Cursor CLI (`agent login`) 提取凭证
 * 2. 交互式输入（如果自动提取失败）
 */
const cursorCliPlugin = {
  id: "cursor-cli-auth",
  name: "Cursor CLI Auth",
  description: "API key authentication for Cursor CLI",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/models",
      aliases: ["cursor"],
      auth: [
        {
          id: "api-key",
          label: "API Key",
          hint: "Auto-detect from Cursor CLI (run 'agent login' first)",
          kind: "api-key",
          run: async (ctx) => {
            const spin = ctx.prompter.progress("Setting up Cursor API key…");
            try {
              // 1. 优先尝试从 Cursor CLI 自动提取凭证
              spin.update("Checking Cursor CLI credentials…");
              const cliCreds = readCursorCliCredentials({
                allowKeychainPrompt: true,
                platform: process.platform,
              });

              let apiKey: string | undefined = cliCreds?.apiKey?.trim();
              let email: string | undefined = cliCreds?.email;

              if (apiKey) {
                ctx.runtime.log(`Found API key from Cursor CLI${email ? ` (${email})` : ""}`);
              } else {
                // 2. 交互式输入
                spin.stop();
                apiKey = await ctx.prompter.text({
                  message: "Enter Cursor API key (or run 'agent login' first)",
                  validate: (value) => {
                    const trimmed = String(value ?? "").trim();
                    if (!trimmed) {
                      return "API key cannot be empty";
                    }
                    return undefined;
                  },
                });
                apiKey = String(apiKey).trim();
              }

              if (!apiKey) {
                throw new Error("API key is required");
              }

              spin.stop("Cursor API key configured");
              const profileId = "cursor-cli:api-key";
              
              // Cursor CLI 支持的模型列表（从 agent models 命令获取）
              // 根据实际输出，配置主要模型
              const cursorModels = [
                { id: "composer-1", name: "Composer 1" },
                { id: "gpt-5.2", name: "GPT-5.2" },
                { id: "gpt-5.2-high", name: "GPT-5.2 High" },
                { id: "gpt-5.2-codex-high", name: "GPT-5.2 Codex High" },
                { id: "opus-4.6-thinking", name: "Claude 4.6 Opus (Thinking)" },
                { id: "sonnet-4.5", name: "Claude 4.5 Sonnet" },
                { id: "sonnet-4.5-thinking", name: "Claude 4.5 Sonnet (Thinking)" },
              ];

              // 查找 agent 命令路径
              const agentCommand = (() => {
                try {
                  const { execSync } = require("node:child_process");
                  return execSync("which agent", { encoding: "utf8" }).trim();
                } catch {
                  return "agent"; // 使用 PATH 中的命令
                }
              })();

              return {
                profiles: [
                  {
                    profileId,
                    credential: {
                      type: "api-key",
                      provider: PROVIDER_ID,
                      apiKey: apiKey,
                      ...(email ? { email } : {}),
                    },
                  },
                ],
                configPatch: {
                  agents: {
                    defaults: {
                      cliBackends: {
                        [PROVIDER_ID]: {
                          command: agentCommand,
                          args: ["--print", "--output-format", "json"],
                          resumeArgs: ["--print", "--output-format", "json", "--resume", "{sessionId}"],
                          output: "json",
                          input: "arg",
                          modelArg: "--model",
                          modelAliases: {
                            // Composer 模型
                            "composer-1": "composer-1",
                            // GPT 模型
                            "gpt-5.2": "gpt-5.2",
                            "gpt-5.2-high": "gpt-5.2-high",
                            "gpt-5.2-codex": "gpt-5.2-codex",
                            "gpt-5.2-codex-high": "gpt-5.2-codex-high",
                            "gpt-5.2-codex-low": "gpt-5.2-codex-low",
                            "gpt-5.2-codex-xhigh": "gpt-5.2-codex-xhigh",
                            "gpt-5.2-codex-fast": "gpt-5.2-codex-fast",
                            "gpt-5.2-codex-high-fast": "gpt-5.2-codex-high-fast",
                            "gpt-5.2-codex-low-fast": "gpt-5.2-codex-low-fast",
                            "gpt-5.2-codex-xhigh-fast": "gpt-5.2-codex-xhigh-fast",
                            "gpt-5.1-codex-max": "gpt-5.1-codex-max",
                            "gpt-5.1-codex-max-high": "gpt-5.1-codex-max-high",
                            "gpt-5.1-high": "gpt-5.1-high",
                            // Claude 模型
                            "opus-4.6-thinking": "opus-4.6-thinking",
                            "opus-4.6": "opus-4.6",
                            "opus-4.5": "opus-4.5",
                            "opus-4.5-thinking": "opus-4.5-thinking",
                            "sonnet-4.5": "sonnet-4.5",
                            "sonnet-4.5-thinking": "sonnet-4.5-thinking",
                            // 兼容旧名称
                            "claude-4.6-opus-high-thinking": "opus-4.6-thinking",
                            // 其他模型
                            "gemini-3-pro": "gemini-3-pro",
                            "gemini-3-flash": "gemini-3-flash",
                            "grok": "grok",
                            "auto": "auto",
                          },
                          sessionArg: "--resume",
                          sessionMode: "existing",
                          sessionIdFields: ["chatId", "session_id", "conversation_id"],
                          clearEnv: ["CURSOR_API_KEY"], // 避免冲突，使用 auth profile 中的 key
                          serialize: true,
                        },
                      },
                      models: Object.fromEntries(
                        cursorModels.map((m) => [`${PROVIDER_ID}/${m.id}`, {}]),
                      ),
                      // 同时配置所有模型别名（用于 fallback）
                      model: {
                        primary: DEFAULT_MODEL,
                      },
                    },
                  },
                },
                defaultModel: DEFAULT_MODEL,
                notes: [
                  "Cursor CLI backend configured.",
                  "The API key is stored in auth-profiles.json.",
                  `Models configured: ${cursorModels.map((m) => m.id).join(", ")}`,
                  `CLI command: ${agentCommand}`,
                  cliCreds
                    ? "Credential was auto-detected from Cursor CLI."
                    : "Tip: Run 'agent login' to automatically sync credentials.",
                  "Note: Cursor CLI is used as a CLI backend (not HTTP API).",
                ],
              };
            } catch (err) {
              spin.stop("Cursor API key setup failed");
              throw err;
            }
          },
        },
      ],
    });
  },
};

export default cursorCliPlugin;
