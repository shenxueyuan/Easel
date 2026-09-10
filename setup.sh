#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Easel 一键安装
# 用法: git clone <repo> && cd Easel && bash setup.sh
#
# 环境隔离：所有 OpenClaw 配置存在 ~/.openclaw-easel/
# 不影响用户本机已有的 OpenClaw 配置
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROFILE="easel"
OC="openclaw --profile $PROFILE"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[easel]${NC} $*"; }
ok()    { echo -e "${GREEN}  ✓${NC} $*"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $*"; }
fail()  { echo -e "${RED}  ✗${NC} $*"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Easel 一键安装"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "环境隔离：~/.openclaw-${PROFILE}/（不影响本机 OpenClaw）"
echo ""

# ---- 1. Node.js >= 22.22.3 ----
find_node() {
    local candidates=(
        "/opt/homebrew/opt/node@22/bin"
        "/opt/homebrew/bin"
        "/usr/local/bin"
        "$(dirname "$(command -v node 2>/dev/null || echo /nonexistent/node)")"
    )
    for dir in "${candidates[@]}"; do
        local node="$dir/node"
        [ -x "$node" ] || continue
        if "$node" -e 'const [a,b,c]=process.versions.node.split(".").map(Number); process.exit((a===22&&(b>22||(b===22&&c>=3)))||(a===24&&b>=15)||a>=25?0:1)' 2>/dev/null; then
            echo "$dir"
            return 0
        fi
    done
    return 1
}

info "检查 Node.js..."
NODE_BIN_DIR="$(find_node || true)"
if [ -z "$NODE_BIN_DIR" ] && [ "$(uname -s)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
    info "安装 Node.js 22..."
    brew install node@22
    NODE_BIN_DIR="$(find_node || true)"
fi
if [ -z "$NODE_BIN_DIR" ]; then
    fail "找不到 OpenClaw 兼容的 Node.js；请安装 Node.js 22.22.3+、24.15+ 或 25.9+"
    exit 1
fi
export PATH="$NODE_BIN_DIR:/opt/homebrew/opt/ffmpeg-full/bin:/opt/homebrew/bin:$PATH"
ok "Node.js $(node --version)"

# ---- 2. npm 源 ----
npm config set registry https://registry.npmjs.org 2>/dev/null
ok "npm registry: npmjs.org"

info "检查完整 ffmpeg..."
if ! command -v ffmpeg >/dev/null 2>&1 || ! ffmpeg -hide_banner -filters 2>/dev/null | grep ' drawtext ' >/dev/null; then
    if [ "$(uname -s)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
        brew install ffmpeg-full
        export PATH="/opt/homebrew/opt/ffmpeg-full/bin:$PATH"
        hash -r
    else
        fail "需要带 drawtext 滤镜的 ffmpeg"
        exit 1
    fi
fi
if ! ffmpeg -hide_banner -filters 2>/dev/null | grep ' drawtext ' >/dev/null; then
    fail "ffmpeg 已安装但仍缺少 drawtext 滤镜"
    exit 1
fi
ok "ffmpeg 已安装并支持 drawtext"

# ---- 3. 安装 OpenClaw ----
info "检查 OpenClaw..."
if command -v openclaw &>/dev/null; then
    ok "OpenClaw $(openclaw --version 2>&1 | head -1)"
else
    info "安装 OpenClaw..."
    npm install -g openclaw@2026.8.2 --loglevel warn 2>&1 | tail -1
    ok "OpenClaw $(openclaw --version 2>&1 | head -1)"
fi

# ---- 4. 初始化 Easel 专属 OpenClaw profile ----
info "初始化 Easel profile (--profile $PROFILE)..."
if [ -f "$HOME/.openclaw-${PROFILE}/openclaw.json" ]; then
    ok "Profile 已存在"
else
    $OC setup --non-interactive --mode local --accept-risk 2>&1 | tail -2
    ok "Profile 初始化完成 → ~/.openclaw-${PROFILE}/"
fi

# ---- 5. 创建统一 Python 环境并安装全部功能依赖 ----
info "创建项目 Python 虚拟环境..."
PYTHON_BASE=""
for candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3 "$(command -v python3 2>/dev/null || true)"; do
    if [ -x "$candidate" ] && "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
        PYTHON_BASE="$candidate"
        break
    fi
done
if [ -z "$PYTHON_BASE" ]; then
    fail "需要 Python 3.10 或更高版本"
    exit 1
fi
if [ ! -x "$PROJECT_ROOT/.venv/bin/python" ]; then
    "$PYTHON_BASE" -m venv "$PROJECT_ROOT/.venv"
fi
PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python"
"$PYTHON_BIN" -m pip install --upgrade pip setuptools wheel --quiet
"$PYTHON_BIN" -m pip install -e "$PROJECT_ROOT[media]" --quiet
"$PYTHON_BIN" -m playwright install chromium
ok "完整 Python 环境已安装 → .venv"

# ---- 6. 构建 Web 前端（Node 已装 → easel web 直接出真 UI，无需手动构建） ----
info "构建 Web 前端..."
if [ -d "$PROJECT_ROOT/web/frontend" ]; then
    (
        cd "$PROJECT_ROOT/web/frontend"
        if [ -f package-lock.json ]; then npm ci --silent || npm install --silent; else npm install --silent; fi
        npm run lint
        npm run build
    )
    if [ ! -f "$PROJECT_ROOT/web/frontend/dist/index.html" ]; then
        fail "前端构建未生成 dist/index.html"
        exit 1
    fi
    ok "前端检查与构建完成 → web/frontend/dist/"
else
    warn "未找到 web/frontend，跳过前端构建"
fi

# ---- 7. 认证配置 ----
info "配置认证..."
if [ -f "$PROJECT_ROOT/.env" ]; then
    ok ".env 已存在"
else
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    warn "已创建 .env，请编辑并填入 API key："
    warn "  vim .env"
fi

# ---- 8. 同步 skills + workspace ----
info "同步 Easel skills..."
bash "$PROJECT_ROOT/openclaw/sync.sh" 2>&1 | grep -E '✓|→'

# ---- 9. 认证信息写入 Easel 专属 OpenClaw config ----
info "同步认证到 OpenClaw profile..."
source "$PROJECT_ROOT/.env" 2>/dev/null || true

DEFAULT_PRIMARY_MODEL="anthropic/claude-sonnet-4-6"
if [ -n "${OPENAI_MAAS_API_KEY:-}" ]; then
    OPENAI_PROVIDER="rednote-openai"
    OPENAI_MODEL="${OPENAI_MAAS_MODEL:-gpt-5.5}"
    OPENAI_PORT="${OPENAI_MAAS_ADAPTER_PORT:-18791}"
    OPENAI_ENDPOINT="${OPENAI_MAAS_ENDPOINT:?OPENAI_MAAS_ENDPOINT is required}"
    OPENAI_MIN_OUTPUT_TOKENS="${OPENAI_MAAS_MIN_OUTPUT_TOKENS:-65536}"
    OPENAI_TIMEOUT_SECONDS="${OPENAI_MAAS_TIMEOUT_SECONDS:-7200}"
    # A new custom provider must be written atomically or OpenClaw rejects the incomplete intermediate state.
    OPENAI_PROVIDER_CONFIG=$("$PYTHON_BIN" - "$PROJECT_ROOT" "$OPENAI_PORT" "$OPENAI_MODEL" \
        "$OPENAI_ENDPOINT" "$OPENAI_MAAS_API_KEY" "$PYTHON_BIN" "$OPENAI_MIN_OUTPUT_TOKENS" "$OPENAI_TIMEOUT_SECONDS" <<'PY'
import json
import sys

root, port, model, endpoint, api_key, python_bin, min_output_tokens, timeout_seconds = sys.argv[1:]
print(json.dumps({
    "baseUrl": f"http://127.0.0.1:{port}/v1",
    "api": "openai-completions",
    "apiKey": "local-adapter",
    "timeoutSeconds": int(timeout_seconds),
    "request": {"allowPrivateNetwork": True},
    "models": [{
        "id": model,
        "name": "OpenAI-compatible model",
        "reasoning": True,
        "input": ["text"],
        "contextWindow": 1048576,
        "contextTokens": 1048576,
        "maxTokens": int(min_output_tokens),
    }],
    "localService": {
        "command": python_bin,
        "args": [f"{root}/scripts/openai_maas_adapter.py", "--port", port],
        "cwd": root,
        "healthUrl": f"http://127.0.0.1:{port}/health",
        "idleStopMs": 0,
        "env": {
            "OPENAI_MAAS_API_KEY": api_key,
            "OPENAI_MAAS_ENDPOINT": endpoint,
            "OPENAI_MAAS_MODEL": model,
            "OPENAI_MAAS_MIN_OUTPUT_TOKENS": min_output_tokens,
            "OPENAI_MAAS_TIMEOUT_SECONDS": timeout_seconds,
        },
    },
}))
PY
)
    $OC config set models.providers."$OPENAI_PROVIDER" "$OPENAI_PROVIDER_CONFIG" \
        --strict-json 2>&1 | tail -1
    DEFAULT_PRIMARY_MODEL="$OPENAI_PROVIDER/$OPENAI_MODEL"
    ok "OpenAI-compatible 服务已通过本地适配器同步"
elif [ -n "${GEMINI_MAAS_API_KEY:-}" ]; then
    GEMINI_PROVIDER="rednote-gemini"
    GEMINI_MODEL="${GEMINI_MAAS_MODEL:-gemini-3.1-pro-preview}"
    $OC config set models.providers."$GEMINI_PROVIDER".baseUrl \
        "http://127.0.0.1:${GEMINI_ADAPTER_PORT:-18790}/v1" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".api "openai-completions" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".apiKey "local-adapter" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".models \
        "[{\"id\":\"$GEMINI_MODEL\",\"name\":\"Gemini-compatible model\",\"reasoning\":true,\"input\":[\"text\",\"image\"],\"contextWindow\":1048576,\"maxTokens\":65535}]" \
        --strict-json 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".timeoutSeconds 600 --strict-json 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".request.allowPrivateNetwork true --strict-json 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.command "$PYTHON_BIN" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.args \
        "[\"$PROJECT_ROOT/scripts/gemini_maas_adapter.py\",\"--port\",\"${GEMINI_ADAPTER_PORT:-18790}\"]" \
        --strict-json 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.cwd "$PROJECT_ROOT" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.healthUrl \
        "http://127.0.0.1:${GEMINI_ADAPTER_PORT:-18790}/health" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.idleStopMs 0 --strict-json 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.env.GEMINI_MAAS_API_KEY \
        "$GEMINI_MAAS_API_KEY" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.env.GEMINI_MAAS_ENDPOINT \
        "${GEMINI_MAAS_ENDPOINT:?GEMINI_MAAS_ENDPOINT is required}" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.env.GEMINI_MAAS_MODEL \
        "$GEMINI_MODEL" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.env.GEMINI_THINKING_LEVEL \
        "${GEMINI_THINKING_LEVEL:-HIGH}" 2>&1 | tail -1
    $OC config set models.providers."$GEMINI_PROVIDER".localService.env.GEMINI_INCLUDE_THOUGHTS \
        "${GEMINI_INCLUDE_THOUGHTS:-true}" 2>&1 | tail -1
    DEFAULT_PRIMARY_MODEL="$GEMINI_PROVIDER/$GEMINI_MODEL"
    ok "Gemini-compatible 服务已通过本地适配器同步"
elif [ -n "${EASEL_LLM_API_KEY:-}" ]; then
    DEFAULT_PRIMARY_MODEL="${CLAUDE_MODEL:-anthropic/claude-sonnet-4-6}"
    $OC config set models.providers.anthropic.apiKey "$EASEL_LLM_API_KEY" 2>&1 | tail -1
    $OC config set models.providers.anthropic.baseUrl "$EASEL_LLM_BASE_URL" 2>&1 | tail -1
    $OC config set models.providers.anthropic.headers."${EASEL_LLM_API_KEY_HEADER:-api-key}" \
        "$EASEL_LLM_API_KEY" 2>&1 | tail -1
    $OC config set models.providers.anthropic.headers.anthropic-version \
        "${EASEL_LLM_ANTHROPIC_VERSION:-2023-06-01}" 2>&1 | tail -1
    # Switching away from CodeWiz must remove its provider-specific headers.
    $OC config unset models.providers.anthropic.headers.Cookie >/dev/null 2>&1 || true
    $OC config unset models.providers.anthropic.headers.X-Adapter-Source >/dev/null 2>&1 || true
    $OC config unset models.providers.anthropic.headers.X-Adapter-Scenario >/dev/null 2>&1 || true
    $OC config unset models.providers.anthropic.headers.X-Adapter-Source-Version >/dev/null 2>&1 || true
    ok "自定义 Anthropic 兼容 MaaS 认证已同步"
elif [ -n "${ANTHROPIC_API_KEY:-}" ] && [ "$ANTHROPIC_API_KEY" != "sk-ant-REPLACE_ME" ]; then
    DEFAULT_PRIMARY_MODEL="${CLAUDE_MODEL:-anthropic/claude-sonnet-4-6}"
    $OC config set models.providers.anthropic.apiKey "$ANTHROPIC_API_KEY" 2>&1 | tail -1
    ok "API key 已同步"
else
    warn "认证未配置 — 编辑 .env 后重新运行 bash setup.sh"
fi

# ---- 10. OpenClaw agent 模型 + 超时 ----
# CLAUDE_MODEL 保留旧变量名以兼容现有环境，值必须是 OpenClaw 的 provider/model。
# 不要填内部 proxy 映射名（如 claude-4.6-opus-google），否则 OpenClaw 不认识。
$OC config set agents.defaults.model.primary "$DEFAULT_PRIMARY_MODEL" 2>&1 | tail -1
# 整个 agent run 的总时长上限。制作层任务（OpenClaw 自执行短剧/长稿/多镜）很久 → 给足。
$OC config set agents.defaults.timeoutSeconds 7200 2>&1 | tail -1
# Easel 使用 profiles/<当前画像>/memory.md；关闭 OpenClaw 全局记忆索引，避免旧索引跨画像召回。
$OC config set memory.search.enabled false --strict-json 2>&1 | tail -1
# 单次 LLM 请求的「空闲超时」（等模型开始/继续产出 token 的最长时间）。内部网关对大上下文/带思考的
# 请求首 token 可能较慢，不设会用默认较短值 → 报「model did not produce a response before the model
# idle timeout」而中断整个 run。与 agents.defaults.timeoutSeconds 是两回事，provider 超时不能延长整个 run。
$OC config set models.providers.anthropic.timeoutSeconds 600 2>&1 | tail -1
$OC config set gateway.mode local 2>&1 | tail -1
$OC config set gateway.bind loopback 2>&1 | tail -1

# ---- 11. 配置免费 Web 搜索并执行完整环境检查 ----
info "配置 Web 搜索..."
if ! $OC plugins inspect parallel >/dev/null 2>&1; then
    $OC plugins install @openclaw/parallel-plugin@2026.8.2 --accept-capabilities
fi
$OC config set tools.web.search.enabled true --strict-json 2>&1 | tail -1
$OC config set tools.web.search.provider parallel-free 2>&1 | tail -1
ok "Web 搜索已配置 → parallel-free"

info "下载 Wechatsync Chrome 扩展包..."
EXT_DIR="$PROJECT_ROOT/assets/extensions"
mkdir -p "$EXT_DIR"
if [ ! -f "$EXT_DIR/wechatsync-2.0.9.zip" ]; then
    if curl -sf -L -o "$EXT_DIR/wechatsync-2.0.9.zip" \
        "https://wpics.oss-cn-shanghai.aliyuncs.com/wechatsync-2.0.9.zip?date=20260324" 2>/dev/null; then
        ok "Wechatsync 扩展包已下载"
    else
        warn "Wechatsync 扩展包下载失败（可从 Chrome 应用商店手动安装）"
    fi
else
    ok "Wechatsync 扩展包已存在"
fi

info "执行完整环境检查..."
"$PYTHON_BIN" -m easel doctor

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}安装完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  开始使用："
echo "    bash start.sh                # 启动完整 Web 工作台"
echo "    .venv/bin/easel doctor       # 检查全部功能与工具"
echo "    .venv/bin/easel ping         # 连通性测试"
echo ""
echo "  环境隔离："
echo "    Easel 配置 → ~/.openclaw-${PROFILE}/"
echo "    用户本机 OpenClaw → ~/.openclaw/ （不受影响）"
echo ""
