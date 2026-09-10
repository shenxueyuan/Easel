#!/usr/bin/env python3
"""Transparent OpenAI Chat Completions proxy for a MaaS URL with fixed query params."""

from __future__ import annotations

import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener


DEFAULT_ENDPOINT = ""
DEFAULT_MODEL = "gpt-5.5"


def load_env_file(path: str) -> None:
    """Load only this adapter's variables without executing shell-formatted .env content."""
    try:
        lines = open(path, encoding="utf-8")
    except OSError:
        return
    with lines:
        for raw in lines:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.startswith("OPENAI_MAAS_"):
                os.environ.setdefault(key, value.strip().strip('"').strip("'"))


class Handler(BaseHTTPRequestHandler):
    server_version = "EaselOpenAIMaaSAdapter/1.0"

    def send_json(self, status: int, payload: dict) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        if self.path.rstrip("/") in ("", "/health"):
            self.send_json(200, {"ok": True})
        elif self.path.rstrip("/") == "/v1/models":
            model = os.environ.get("OPENAI_MAAS_MODEL", DEFAULT_MODEL)
            self.send_json(200, {"object": "list", "data": [{"id": model, "object": "model"}]})
        else:
            self.send_json(404, {"error": {"message": "not found"}})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/v1/chat/completions":
            self.send_json(404, {"error": {"message": "not found"}})
            return

        try:
            api_key = os.environ.get("OPENAI_MAAS_API_KEY", "")
            if not api_key:
                raise RuntimeError("OPENAI_MAAS_API_KEY is not configured")

            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length)
            endpoint = os.environ.get("OPENAI_MAAS_ENDPOINT", DEFAULT_ENDPOINT)
            # endpoint 可能是 base URL（如 https://api.siliconflow.cn/v1），
            # 需要拼上 /chat/completions
            if endpoint and not endpoint.endswith("/chat/completions"):
                endpoint = endpoint.rstrip("/") + "/chat/completions"

            try:
                body = json.loads(raw_body)
                model = body.get("model", "")
                if "/" in model and not model.startswith("http"):
                    body["model"] = model.split("/", 1)[1]
                configured_model = os.environ.get("OPENAI_MAAS_MODEL", "deepseek-v4-flash-0731").strip()
                min_output_tokens = int(os.environ.get("OPENAI_MAAS_MIN_OUTPUT_TOKENS", "65536"))
                if body.get("model") == configured_model or str(body.get("model", "")).startswith("deepseek-v4"):
                    cur = body.get("max_tokens")
                    cur2 = body.get("max_completion_tokens")
                    effective_cur = cur if cur is not None else cur2
                    if effective_cur is None or (isinstance(effective_cur, int) and effective_cur < min_output_tokens):
                        body["max_tokens"] = min_output_tokens
                        if "max_completion_tokens" in body:
                            body["max_completion_tokens"] = min_output_tokens
                # 诊断日志
                msgs = body.get("messages", [])
                msg_count = len(msgs)
                stream = body.get("stream", False)
                print(f"[adapter] model={body.get('model')} max_tokens={body.get('max_tokens')} msgs={msg_count} stream={stream}", flush=True)
                raw_body = json.dumps(body, ensure_ascii=False).encode()
            except (json.JSONDecodeError, TypeError):
                pass  # 非 JSON 或解析失败，原样转发

            request = Request(
                endpoint,
                data=raw_body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": self.headers.get("Content-Type", "application/json"),
                    "Accept": self.headers.get("Accept", "*/*"),
                },
                method="POST",
            )

            # Internal MaaS should not inherit workstation-wide outbound proxies.
            upstream_timeout = int(os.environ.get("OPENAI_MAAS_TIMEOUT_SECONDS", "7200"))
            with build_opener(ProxyHandler({})).open(request, timeout=upstream_timeout) as response:
                self.send_response(response.status)
                self.send_header(
                    "Content-Type",
                    response.headers.get("Content-Type", "application/json"),
                )
                self.send_header("Cache-Control", response.headers.get("Cache-Control", "no-cache"))
                request_id = response.headers.get("x-request-id")
                if request_id:
                    self.send_header("x-request-id", request_id)
                self.end_headers()

                # readline preserves SSE event boundaries and forwards each event immediately.
                # 同时解析 SSE 事件，记录 finish_reason 和 usage 用于诊断。
                collected_finish = None
                collected_usage = None
                while chunk := response.readline():
                    self.wfile.write(chunk)
                    self.wfile.flush()
                    # 解析 SSE data 行以收集诊断信息
                    if chunk.startswith(b"data: ") and not chunk.startswith(b"data: [DONE]"):
                        try:
                            ev = json.loads(chunk[6:].strip())
                            choices = ev.get("choices", [])
                            if choices:
                                fr = choices[0].get("finish_reason")
                                if fr:
                                    collected_finish = fr
                            u = ev.get("usage")
                            if u:
                                collected_usage = u
                        except (json.JSONDecodeError, ValueError):
                            pass
                if collected_finish or collected_usage:
                    print(f"[adapter] response finish_reason={collected_finish} usage={collected_usage}", flush=True)
        except HTTPError as exc:
            detail = exc.read()
            self.send_response(exc.code)
            self.send_header("Content-Type", exc.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(detail)))
            self.end_headers()
            self.wfile.write(detail)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (URLError, OSError, ValueError, RuntimeError) as exc:
            self.send_json(502, {"error": {"message": str(exc)}})

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[openai-maas-adapter] {self.address_string()} {fmt % args}", flush=True)


class Server(ThreadingHTTPServer):
    daemon_threads = True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int)
    parser.add_argument("--env-file")
    args = parser.parse_args()
    if args.env_file:
        load_env_file(args.env_file)
    port = args.port or int(os.environ.get("OPENAI_MAAS_ADAPTER_PORT", "18791"))
    Server((args.host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
