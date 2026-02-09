# Cursor CLI 支持的模型列表

## 📋 主要模型列表

根据 Cursor CLI (`agent models`) 命令输出，当前支持以下主要模型：

### 1. Composer 模型

#### `composer-1` ⭐ **默认**
- **类型**: Composer 1
- **特点**: 
  - 默认模型
  - 适合通用编程任务
- **使用方式**: `cursor-cli/composer-1`

### 2. GPT 模型

#### `gpt-5.2`
- **类型**: GPT-5.2（标准版）
- **特点**:
  - 通用编程任务
  - 平衡性能和成本
- **使用方式**: `cursor-cli/gpt-5.2`

#### `gpt-5.2-high`
- **类型**: GPT-5.2（高性能版）
- **特点**:
  - 更高的性能和质量
  - 适合复杂任务
- **使用方式**: `cursor-cli/gpt-5.2-high`

#### `gpt-5.2-codex-high`
- **类型**: GPT-5.2 Codex（高性能版）
- **特点**:
  - 专门优化的代码生成模型
  - 适合代码相关任务
- **使用方式**: `cursor-cli/gpt-5.2-codex-high`

### 3. Claude 模型

#### `opus-4.6-thinking`
- **类型**: Claude 4.6 Opus（思考模式）
- **特点**: 
  - 支持深度推理和思考链
  - 适合复杂编程任务
- **使用方式**: `cursor-cli/opus-4.6-thinking`
- **兼容名称**: `cursor-cli/claude-4.6-opus-high-thinking`（自动映射）

#### `sonnet-4.5`
- **类型**: Claude 4.5 Sonnet
- **特点**: 
  - 平衡性能和速度
  - 适合一般编程任务
- **使用方式**: `cursor-cli/sonnet-4.5`

#### `sonnet-4.5-thinking`
- **类型**: Claude 4.5 Sonnet（思考模式）
- **特点**: 
  - 支持思考链
  - 适合需要深度推理的任务
- **使用方式**: `cursor-cli/sonnet-4.5-thinking`

## 📊 模型对比

| 模型 | 类型 | 推荐场景 | 性能 |
|------|------|----------|------|
| `composer-1` | Composer | 通用编程任务（默认） | ⭐⭐⭐⭐ |
| `gpt-5.2` | GPT | 通用编程任务 | ⭐⭐⭐⭐ |
| `gpt-5.2-high` | GPT | 高性能需求 | ⭐⭐⭐⭐⭐ |
| `gpt-5.2-codex-high` | GPT Codex | 代码生成优化 | ⭐⭐⭐⭐⭐ |
| `opus-4.6-thinking` | Claude | 复杂推理、深度思考 | ⭐⭐⭐⭐⭐ |
| `sonnet-4.5` | Claude | 一般编程任务 | ⭐⭐⭐⭐ |
| `sonnet-4.5-thinking` | Claude | 需要思考链的任务 | ⭐⭐⭐⭐⭐ |

## 🔧 使用方法

### 设置默认模型

```bash
# 设置为默认模型（当前默认是 composer-1）
openclaw models set cursor-cli/composer-1

# 或使用其他模型
openclaw models set cursor-cli/gpt-5.2
openclaw models set cursor-cli/opus-4.6-thinking
openclaw models set cursor-cli/gpt-5.2-high
```

### 在配置文件中设置

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "cursor-cli/composer-1"
      },
      models: {
        "cursor-cli/composer-1": {},
        "cursor-cli/gpt-5.2": {},
        "cursor-cli/gpt-5.2-high": {},
        "cursor-cli/gpt-5.2-codex-high": {},
        "cursor-cli/opus-4.6-thinking": {},
        "cursor-cli/sonnet-4.5": {},
        "cursor-cli/sonnet-4.5-thinking": {}
      }
    }
  }
}
```

### 添加为备用模型（Fallback）

```bash
# 添加备用模型
openclaw models fallbacks add cursor-cli/gpt-5.2-high
openclaw models fallbacks add cursor-cli/opus-4.6-thinking
```

## 📝 注意事项

1. **模型名称格式**: 
   - 在 OpenClaw 中使用时需要加上提供者前缀：`cursor-cli/{model-id}`
   - 例如：`cursor-cli/composer-1`、`cursor-cli/gpt-5.2`

2. **模型别名**: 
   - 支持旧名称映射，例如 `claude-4.6-opus-high-thinking` 会自动映射到 `opus-4.6-thinking`

3. **模型可用性**: 
   - 模型列表可能会更新
   - 建议使用 `agent models` 命令获取最新列表

4. **CLI Backend**: 
   - 此插件使用 Cursor CLI (`agent` 命令) 作为后端
   - 不是直接调用 HTTP API

## 📚 相关文档

- [Cursor CLI 文档](https://cursor.com/docs)
- [OpenClaw 模型配置文档](../../docs/concepts/model-providers.md)
