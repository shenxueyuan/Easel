#!/usr/bin/env bash
set -uo pipefail

# ============================================================
# Easel 一键启动
# 用法: bash start.sh [stop|restart|status]
#
# 自动完成：
#   1. 检查 Node.js 版本（找兼容版本，不改系统默认）
#   2. 停掉已运行的 Gateway（--local 模式不需要 Gateway）
#   3. 启动 LLM Adapter（端口 18791）
#   4. 启动 Web UI（端口 7860）
#   5. 健康检查，打印访问地址
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROFILE="easel"
GATEWAY_PORT=18789
WEB_PORT=7860
ADAPTER_PORT="${OPENAI_MAAS_ADAPTER_PORT:-18791}"

GATEWAY_LOG="/tmp/easel-gateway.log"
ADAPTER_LOG="/tmp/easel-openai-maas-adapter.log"
WEB_LOG="/tmp/easel-web.log"

# ---- 颜色 ----
G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; C='\033[0;36m'; N='\033[0m'
info()  { echo -e "${C}[easel]${N} $*"; }
ok()    { echo -e "${G}  ✓${N} $*"; }
warn()  { echo -e "${Y}  ⚠${N} $*"; }
fail()  { echo -e "${R}  ✗${N} $*"; }

# ---- 找兼容的 Node.js ----
find_node() {
    local candidates=(
        "/opt/homebrew/Cellar/node@22/22.23.2/bin"
        "/opt/homebrew/opt/node@22/bin"
        "/opt/homebrew/bin"
        "/usr/local/bin"
    )
    for dir in "${candidates[@]}"; do
        local node="$dir/node"
        if [ -x "$node" ]; then
            local ver
            ver="$("$node" --version 2>/dev/null || echo 'v0')"
            # openclaw 需要 >=22.22.3 <23, >=24.15.0 <25, or >=25.9.0
            local major="${ver#v}"
            major="${major%%.*}"
            if [ "$major" -ge 22 ] 2>/dev/null; then
                echo "$dir"
                return 0
            fi
        fi
    done
    return 1
}

NODE_BIN_DIR="$(find_node || true)"
if [ -z "$NODE_BIN_DIR" ]; then
    fail "找不到兼容的 Node.js（需要 >=22.22.3）"
    fail "请先运行: brew install node@22"
    exit 1
fi
export PATH="$NODE_BIN_DIR:$PATH"
OC="openclaw --profile $PROFILE"

# ---- 找 Python ----
find_python() {
    local candidates=(
        "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"
        "/opt/homebrew/bin/python3"
        "/usr/local/bin/python3"
        "$(which python3 2>/dev/null)"
    )
    for p in "${candidates[@]}"; do
        if [ -x "$p" ]; then
            echo "$p"
            return 0
        fi
    done
    return 1
}
PYTHON_BIN="$(find_python || true)"
if [ -z "$PYTHON_BIN" ]; then
    fail "找不到 python3"
    exit 1
fi

# ---- 端口检查 ----
port_in_use() { lsof -ti:"$1" 2>/dev/null | head -1 || true; }
gateway_live() { curl -sf --max-time 2 "http://localhost:${GATEWAY_PORT}/healthz" >/dev/null 2>&1 || false; }
web_live() { curl -sf --max-time 2 "http://localhost:${WEB_PORT}" >/dev/null 2>&1 || false; }
adapter_live() { curl -sf --max-time 2 "http://127.0.0.1:${ADAPTER_PORT}/health" >/dev/null 2>&1 || false; }

# ---- 启动 Adapter ----
start_adapter() {
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        warn ".env 不存在，跳过 LLM adapter"
        return 0
    fi
    if ! grep -q '^OPENAI_MAAS_API_KEY=' "$PROJECT_ROOT/.env" 2>/dev/null; then
        warn ".env 里没配 OPENAI_MAAS_API_KEY，跳过 LLM adapter"
        return 0
    fi
    if adapter_live; then
        ok "LLM adapter 已在运行 (端口 $ADAPTER_PORT)"
        return 0
    fi
    info "启动 LLM adapter..."
    nohup "$PYTHON_BIN" "$PROJECT_ROOT/scripts/openai_maas_adapter.py" \
        --env-file "$PROJECT_ROOT/.env" --port "$ADAPTER_PORT" \
        > "$ADAPTER_LOG" 2>&1 &
    for _ in $(seq 1 20); do
        adapter_live && { ok "LLM adapter 已启动 (端口 $ADAPTER_PORT)"; return 0; }
        sleep 0.25
    done
    warn "LLM adapter 可能未就绪，检查: $ADAPTER_LOG"
}

# ---- 停掉 Gateway（--local 模式不需要，且会冲突）----
stop_gateway() {
    # 停掉 launchd 服务
    launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.easel.plist 2>/dev/null
    # 停掉进程
    local pid
    pid="$(port_in_use "$GATEWAY_PORT")"
    if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null
        sleep 1
        ok "Gateway 已停止（--local 模式不需要）"
    fi
    # 清理锁文件
    rm -f ~/.openclaw-easel/tmp/openclaw-501/gateway.*.lock 2>/dev/null
    rm -f ~/.openclaw-easel/tmp/openclaw-501/gateway.*.lock.sqlite* 2>/dev/null
}

# ---- 启动 Web UI ----
start_web() {
    if web_live; then
        ok "Web UI 已在运行 (端口 $WEB_PORT)"
        return 0
    fi
    info "启动 Web UI..."
    nohup "$PYTHON_BIN" -m uvicorn web.app:app --host 0.0.0.0 --port "$WEB_PORT" \
        > "$WEB_LOG" 2>&1 &
    for _ in $(seq 1 20); do
        web_live && { ok "Web UI 已启动 (端口 $WEB_PORT)"; return 0; }
        sleep 0.5
    done
    fail "Web UI 启动失败，检查: $WEB_LOG"
    tail -5 "$WEB_LOG" 2>/dev/null
    return 1
}

# ---- 停止 ----
stop_all() {
    info "停止 Easel..."
    # Web UI
    local pid; pid="$(port_in_use "$WEB_PORT")"
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && ok "Web UI 已停止" || ok "Web UI 未运行"
    # Gateway
    pid="$(port_in_use "$GATEWAY_PORT")"
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && ok "Gateway 已停止" || ok "Gateway 未运行"
    # Adapter
    pid="$(port_in_use "$ADAPTER_PORT")"
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && ok "LLM adapter 已停止" || ok "LLM adapter 未运行"
}

# ---- 状态 ----
show_status() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Easel 运行状态"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if gateway_live; then
        ok "Gateway    : http://localhost:$GATEWAY_PORT  (运行中)"
    else
        fail "Gateway    : 离线"
    fi
    if adapter_live; then
        ok "LLM Adapter: http://localhost:$ADAPTER_PORT  (运行中)"
    else
        warn "LLM Adapter: 未运行"
    fi
    if web_live; then
        ok "Web UI     : http://localhost:$WEB_PORT  (运行中)"
    else
        fail "Web UI     : 离线"
    fi
    echo ""
    if web_live; then
        echo "  👉 打开浏览器: http://localhost:$WEB_PORT"
    fi
    echo ""
}

# ---- 主逻辑 ----
case "${1:-start}" in
    start)
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Easel 一键启动"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        info "Node: $(node --version) ($NODE_BIN_DIR)"
        info "Python: $($PYTHON_BIN --version) ($PYTHON_BIN)"
        echo ""
        stop_gateway
        start_adapter
        start_web
        show_status
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        "$0" start
        ;;
    status)
        show_status
        ;;
    logs)
        local svc="${2:-web}"
        case "$svc" in
            web)      tail -f "$WEB_LOG" ;;
            gateway)  tail -f "$GATEWAY_LOG" ;;
            adapter)  tail -f "$ADAPTER_LOG" ;;
            *)        echo "用法: $0 logs {web|gateway|adapter}"; exit 1 ;;
        esac
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs [web|gateway|adapter]}"
        echo ""
        echo "  start    一键启动 Gateway + Adapter + Web UI"
        echo "  stop     停止所有服务"
        echo "  restart  重启所有服务"
        echo "  status   查看运行状态"
        echo "  logs     查看日志（默认 web，可选 gateway/adapter）"
        exit 1
        ;;
esac
