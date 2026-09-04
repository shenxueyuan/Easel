#!/usr/bin/env bash
set -euo pipefail

# Easel — 同步 SKILL + workspace 到 OpenClaw 的 easel 隔离 profile
#
# --profile easel 的实际路径：
#   workspace → ~/.openclaw-easel/workspace/
#   config    → ~/.openclaw-easel/openclaw.json
#
# 用法：bash openclaw/sync.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROFILE="easel"
# --profile easel 的 workspace 在 ~/.openclaw-easel/workspace/
OPENCLAW_WORKSPACE_DST="$HOME/.openclaw-${PROFILE}/workspace"
OPENCLAW_SKILL_DST="$OPENCLAW_WORKSPACE_DST/skills"
OPENCLAW_WORKSPACE_SRC="$SCRIPT_DIR/workspace"
OPENCLAW_SKILL_SRC="$PROJECT_ROOT/skills/openclaw"

echo "[easel] Syncing to OpenClaw profile: $PROFILE"
echo "  workspace → $OPENCLAW_WORKSPACE_DST"
echo ""

# ---- 确保目录存在 ----
mkdir -p "$OPENCLAW_SKILL_DST"
mkdir -p "$OPENCLAW_WORKSPACE_DST"

# ---- 标记已删除的 SKILL ----
for dst_dir in "$OPENCLAW_SKILL_DST"/*/; do
    [ -d "$dst_dir" ] || continue
    name=$(basename "$dst_dir")
    if [ ! -d "$OPENCLAW_SKILL_SRC/$name" ]; then
        echo "  ! $name (stale — source no longer exists)"
    fi
done

# ---- 同步 skills ----
# 单一技能库：五层（发现/策划/制作/发布/归因）全部由 OpenClaw 直接执行，
# SKILL 完整同步进 workspace，OpenClaw 读进来照其流程自己产出。
echo "Skills:"
synced=0
for skill_dir in "$OPENCLAW_SKILL_SRC"/*/; do
    [ -d "$skill_dir" ] || continue
    name=$(basename "$skill_dir")
    mkdir -p "$OPENCLAW_SKILL_DST/$name"
    cp -R "$skill_dir/." "$OPENCLAW_SKILL_DST/$name/"
    echo "  ✓ $name"
    synced=$((synced + 1))
done
echo "  ($synced skills synced)"
echo ""

# ---- 同步 shared/ 跨 SKILL 共享层 ----
# 多个 SKILL 用 ../../shared/xxx.md 引用（workspace 扁平化后解析为 workspace/shared/）
SHARED_SRC="$PROJECT_ROOT/skills/shared"
SHARED_DST="$OPENCLAW_WORKSPACE_DST/shared"
if [ -d "$SHARED_SRC" ]; then
    mkdir -p "$SHARED_DST"
    cp -R "$SHARED_SRC/." "$SHARED_DST/"
    echo "Shared: ✓ synced → workspace/shared/ ($(find "$SHARED_DST" -type f | wc -l) files)"
    echo ""
fi

# ---- 同步 workspace 文件（AGENTS.md / SOUL.md） ----
echo "Workspace:"
for f in "$OPENCLAW_WORKSPACE_SRC"/*.md; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    target="$OPENCLAW_WORKSPACE_DST/$name"
    if [ -f "$target" ] && ! cmp -s "$f" "$target"; then
        cp "$target" "${target}.backup-$(date +%Y%m%d%H%M%S)"
    fi
    cp "$f" "$target"
    echo "  ✓ $name"
done

# AGENTS.md is injected every turn. Embed the resolved project root there so
# configuration checks never fall back to the workspace's shared/ copy.
cat >> "$OPENCLAW_WORKSPACE_DST/AGENTS.md" << AGENTROOTEOF

## 运行时项目根（由 openclaw/sync.sh 生成）

Easel 项目根绝对路径：\`$PROJECT_ROOT\`

运行任何 \`skills/...\` 项目脚本前都必须先执行：

\`\`\`bash
cd "$PROJECT_ROOT"
test -f .env && test -d skills/shared/scripts
\`\`\`

不得在 \`$OPENCLAW_WORKSPACE_DST\` 的 \`shared/\` 副本中检查 Key、URL 或模型配置。
AGENTROOTEOF
echo "  ✓ AGENTS.md runtime project root"
echo ""

# ---- 保留全局用户文件 ----
# Easel 通过 memory.search.enabled=false 禁用全局检索，不修改用户已有的 USER.md / MEMORY.md。
[ -f "$OPENCLAW_WORKSPACE_DST/MEMORY.md" ] || : > "$OPENCLAW_WORKSPACE_DST/MEMORY.md"
echo "Workspace memory: ✓ preserved"
echo ""

# ---- Profile 目录 symlink ----
# 注意：必须先删除旧 symlink 再创建，否则 ln -sf 会跟着旧 symlink 进入目标目录创建循环
PROFILE_LINK="$OPENCLAW_WORKSPACE_DST/easel-profiles"
if [ -e "$PROFILE_LINK" ] && [ ! -L "$PROFILE_LINK" ]; then
    echo "Profiles: ! 保留现有目录 $PROFILE_LINK"
else
    ln -sfn "$PROJECT_ROOT/profiles" "$PROFILE_LINK"
    echo "Profiles: ✓ symlinked → $PROJECT_ROOT/profiles"
fi

# ---- outputs 目录 symlink ----
# Agent CWD 是 workspace，SKILL 写 outputs/ 会落到 workspace 内
# 通过 symlink 让 workspace/outputs/ → 项目 outputs/，产物自动归位
OUTPUTS_LINK="$OPENCLAW_WORKSPACE_DST/outputs"
mkdir -p "$PROJECT_ROOT/outputs"
if [ -d "$OUTPUTS_LINK" ] && [ ! -L "$OUTPUTS_LINK" ]; then
    OUTPUTS_BACKUP="${OUTPUTS_LINK}.backup-$(date +%Y%m%d%H%M%S)"
    mv "$OUTPUTS_LINK" "$OUTPUTS_BACKUP"
    if ! cp -Rn "$OUTPUTS_BACKUP/." "$PROJECT_ROOT/outputs/"; then
        echo "Outputs: ! 部分同名文件未覆盖；完整原目录保留为 $OUTPUTS_BACKUP"
    else
        echo "Outputs: ✓ 原目录已保留为 $OUTPUTS_BACKUP"
    fi
fi
ln -sfn "$PROJECT_ROOT/outputs" "$OUTPUTS_LINK"
echo "Outputs: ✓ symlinked → $PROJECT_ROOT/outputs"
echo ""

# ---- 记录项目根路径（供 workspace 内人工/工具读取；AGENTS.md 另有每轮注入副本） ----
cat > "$OPENCLAW_WORKSPACE_DST/CONTEXT.md" << CTXEOF
# Easel 项目路径

项目根目录：$PROJECT_ROOT

发现 / 策划 / 制作 / 发布 / 归因五层全部由你直接执行。跑项目脚本 / 产出成品前先 \`cd\` 到项目根
（**本 claude 版本不支持 --cwd**）：
\`\`\`
cd $PROJECT_ROOT && python skills/shared/scripts/<脚本>.py ...   # 制作 / 发布 / 分析脚本
\`\`\`
技能库已完整同步（\`skills/\`），读进来照其流程自己产出到 \`outputs/\`。

产物输出到：$PROJECT_ROOT/outputs/
用户素材在：$PROJECT_ROOT/assets/
用户画像在：$PROJECT_ROOT/profiles/
CTXEOF
echo "Project context: ✓ CONTEXT.md"
echo ""

echo "[easel] Sync done."
