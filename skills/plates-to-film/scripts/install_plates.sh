#!/usr/bin/env bash
# 安装素材流水线 plates：专用 Python 环境（Pillow）+ 命令入口 ~/.local/bin/plates。
# 可灵视频还需要官方 CLI：国内站 npm i -g @klingai/cli-cn --registry=https://registry.npmjs.org，然后 kling login
# （海外站用 @klingai/cli-global）。image2 需要 OpenRouter key：复制 key 后运行 plates setkey。
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
if command -v uv >/dev/null; then uv venv -q --python 3.12 "$HOME/.venvs/plates"; VIRTUAL_ENV="$HOME/.venvs/plates" uv pip install -q pillow
else python3 -m venv "$HOME/.venvs/plates"; "$HOME/.venvs/plates/bin/pip" install -q pillow; fi
chmod +x "$D/plates"; mkdir -p "$HOME/.local/bin"; ln -sfn "$D/plates" "$HOME/.local/bin/plates"
echo "✓ plates 已安装（~/.local/bin/plates）"
command -v kling >/dev/null && echo "✓ 可灵 CLI：$(kling --version)" || echo "· 可灵 CLI 未安装（只做图片可以不装）"
[ -s "$HOME/.config/plate-pipeline/openrouter.key" ] || [ -n "${OPENROUTER_API_KEY:-}" ] && echo "✓ OpenRouter key 已配置" || echo "· 还没有 OpenRouter key：复制 key 后运行 plates setkey"
