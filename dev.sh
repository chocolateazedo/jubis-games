#!/usr/bin/env bash
# Ambiente de desenvolvimento local do Jubis Games via Docker.
# Sobe um servidor PHP servindo o repositório em http://localhost:8095.
# O repositório é montado no container, então editar arquivos reflete na hora
# (basta recarregar a página — o php -S não cacheia).
#
# Uso:
#   ./dev.sh up      # sobe (padrão)
#   ./dev.sh stop    # derruba
#   ./dev.sh logs    # acompanha os logs
#   ./dev.sh status  # mostra o estado
set -e

NAME=jubis-games-dev
PORT=8095
IMAGE=jubis-games-dev:php82      # imagem própria com pdo_pgsql (ver dev/Dockerfile)
DIR="$(cd "$(dirname "$0")" && pwd)"

case "${1:-up}" in
  up|start)
    docker build -t "$IMAGE" "$DIR/dev" >/dev/null
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" --restart unless-stopped \
      -p "$PORT:$PORT" -v "$DIR:/app" -w /app \
      "$IMAGE" php -S 0.0.0.0:"$PORT" -t /app
    echo "✅ Jubis Games rodando em http://localhost:$PORT"
    ;;
  stop|down)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    echo "🛑 parado"
    ;;
  logs)
    docker logs -f "$NAME"
    ;;
  status)
    docker ps --filter "name=$NAME" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    ;;
  *)
    echo "uso: ./dev.sh [up|stop|logs|status]"; exit 1
    ;;
esac
