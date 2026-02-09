import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import { loadJsonFile } from "../../src/infra/json-file.js";

/**
 * Cursor CLI 凭证类型
 */
export type CursorCliCredential = {
  type: "api-key";
  provider: "cursor-cli";
  apiKey: string;
  email?: string;
};

/**
 * Cursor CLI 配置路径
 */
const CURSOR_CLI_CONFIG_PATH = join(homedir(), ".cursor", "cli-config.json");

/**
 * Cursor CLI 状态路径（保留以备将来使用）
 */
const _CURSOR_CLI_STATE_PATH = join(homedir(), ".cursor", "agent-cli-state.json");

/**
 * 从 Cursor CLI 配置文件中读取用户信息
 * 
 * 注意：Cursor CLI 可能将 API Key 存储在：
 * 1. CLI 配置文件中（通常不存储）
 * 2. 系统密钥链中（macOS，通过 agent login 设置）
 * 
 * 当前实现只提取用户信息（email），API Key 从 Keychain 读取
 */
function readCursorCliConfig(): { email?: string } | null {
  try {
    if (!existsSync(CURSOR_CLI_CONFIG_PATH)) {
      return null;
    }

    const config = loadJsonFile(CURSOR_CLI_CONFIG_PATH);
    if (!config || typeof config !== "object") {
      return null;
    }

    const data = config as Record<string, unknown>;
    const authInfo = data.authInfo as { email?: string } | undefined;
    const email = authInfo?.email;

    // Cursor CLI 不直接在配置文件中存储 API Key
    // API Key 通过 agent login 命令存储在 Keychain 中
    // 这里只提取用户信息

    return {
      email,
    };
  } catch {
    return null;
  }
}

/**
 * 尝试从 macOS Keychain 读取 Cursor CLI 凭证
 * 
 * Cursor CLI 可能使用多种 Keychain 服务名称，尝试多个可能的名称
 */
function readCursorCliKeychainCredentials(): CursorCliCredential | null {
  if (process.platform !== "darwin") {
    return null;
  }

  // 尝试多个可能的 Keychain 服务名称
  const possibleServices = [
    "Cursor CLI",
    "Cursor",
    "cursor.com",
    "Cursor Agent",
  ];

  for (const service of possibleServices) {
    try {
      // 尝试不同的账户名称
      const possibleAccounts = ["API Key", "api-key", "token", "access_token", ""];
      
      for (const account of possibleAccounts) {
        try {
          const cmd = account
            ? `security find-generic-password -s "${service}" -a "${account}" -w 2>/dev/null`
            : `security find-generic-password -s "${service}" -w 2>/dev/null`;
          
          const result = execSync(cmd, {
            encoding: "utf8",
            timeout: 5000,
            stdio: ["pipe", "pipe", "pipe"],
          });

          const value = result.trim();
          if (!value) {
            continue;
          }

          // 尝试解析为 JSON（Cursor 可能存储 JSON）
          let apiKey: string | undefined;
          try {
            const parsed = JSON.parse(value) as Record<string, unknown>;
            // 检查常见的字段名
            apiKey =
              (parsed.apiKey as string)?.trim() ||
              (parsed.api_key as string)?.trim() ||
              (parsed.token as string)?.trim() ||
              (parsed.accessToken as string)?.trim() ||
              (parsed.access_token as string)?.trim();
          } catch {
            // 如果不是 JSON，直接作为 API Key
            apiKey = value;
          }

          if (apiKey && apiKey.length > 10) {
            const config = readCursorCliConfig();
            return {
              type: "api-key",
              provider: "cursor-cli",
              apiKey,
              email: config?.email,
            };
          }
        } catch {
          // 继续尝试下一个账户名
          continue;
        }
      }
    } catch {
      // 继续尝试下一个服务名
      continue;
    }
  }

  // 所有尝试都失败
  return null;
}

/**
 * 读取 Cursor CLI 凭证
 * 
 * 从 macOS Keychain 读取（通过 agent login 设置）
 * 如果 Keychain 中不存在，返回 null（需要手动输入）
 */
export function readCursorCliCredentials(options?: {
  allowKeychainPrompt?: boolean;
  platform?: NodeJS.Platform;
}): CursorCliCredential | null {
  // 尝试从 Keychain 读取（macOS）
  const platform = options?.platform ?? process.platform;
  if (platform === "darwin" && options?.allowKeychainPrompt !== false) {
    const keychainCreds = readCursorCliKeychainCredentials();
    if (keychainCreds) {
      return keychainCreds;
    }
  }

  // 无法自动提取，返回 null
  return null;
}

/**
 * 带缓存的读取 Cursor CLI 凭证
 */
let cursorCliCache: { value: CursorCliCredential | null; readAt: number } | null = null;

export function readCursorCliCredentialsCached(options?: {
  ttlMs?: number;
  allowKeychainPrompt?: boolean;
  platform?: NodeJS.Platform;
}): CursorCliCredential | null {
  const ttlMs = options?.ttlMs ?? 0;
  const now = Date.now();

  if (ttlMs > 0 && cursorCliCache && now - cursorCliCache.readAt < ttlMs) {
    return cursorCliCache.value;
  }

  const value = readCursorCliCredentials({
    allowKeychainPrompt: options?.allowKeychainPrompt,
    platform: options?.platform,
  });

  if (ttlMs > 0) {
    cursorCliCache = { value, readAt: now };
  }

  return value;
}
