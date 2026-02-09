#!/usr/bin/env node
/**
 * 测试脚本：验证 Cursor CLI 插件提供者是否正确注册
 * 
 * 运行方式：
 *   cd extensions/cursor-cli-auth
 *   bun test-provider.ts
 */

import { loadConfig } from "../../src/config/config.js";
import { resolvePluginProviders } from "../../src/plugins/providers.js";
import { resolveDefaultAgentId } from "../../src/agents/agent-scope.js";
import { resolveAgentWorkspaceDir } from "../../src/agents/agent-scope.js";

const config = loadConfig();
const agentId = resolveDefaultAgentId(config);
const workspaceDir = resolveAgentWorkspaceDir(config, agentId);

console.log("Loading plugin providers...");
const providers = resolvePluginProviders({ config, workspaceDir });

console.log(`\nFound ${providers.length} provider(s):\n`);

const cursorProvider = providers.find((p) => p.id === "cursor-cli" || p.aliases?.includes("cursor"));

if (cursorProvider) {
  console.log("✅ Cursor CLI provider found!");
  console.log(`   ID: ${cursorProvider.id}`);
  console.log(`   Label: ${cursorProvider.label}`);
  console.log(`   Aliases: ${cursorProvider.aliases?.join(", ") || "none"}`);
  console.log(`   Auth methods: ${cursorProvider.auth.length}`);
  cursorProvider.auth.forEach((method, idx) => {
    console.log(`     ${idx + 1}. ${method.id} (${method.kind}) - ${method.label}`);
  });
  console.log(`   Env vars: ${cursorProvider.envVars?.join(", ") || "none"}`);
} else {
  console.log("❌ Cursor CLI provider NOT found!");
  console.log("\nAvailable providers:");
  providers.forEach((p) => {
    console.log(`   - ${p.id} (${p.label})`);
  });
}

process.exit(cursorProvider ? 0 : 1);
