#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/compose.yaml" ]]; then
  readonly DEPLOY_DIR="${SCRIPT_DIR}"
elif [[ -f "${SCRIPT_DIR}/../compose.yaml" ]]; then
  readonly DEPLOY_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
else
  echo "Error: compose.yaml was not found next to this script or in its parent directory." >&2
  exit 1
fi

readonly HEALTH_TIMEOUT_SECONDS="${UPDATE_HEALTH_TIMEOUT_SECONDS:-180}"
readonly HEALTH_POLL_SECONDS="${UPDATE_HEALTH_POLL_SECONDS:-2}"
readonly LOCK_DIR="${DEPLOY_DIR}/.update.lock"

log() {
  printf '[%(%Y-%m-%d %H:%M:%S)T] %s\n' -1 "$*"
}

fail() {
  log "Error: $*" >&2
  exit 1
}

compose() {
  docker compose --project-directory "${DEPLOY_DIR}" -f "${DEPLOY_DIR}/compose.yaml" "$@"
}

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}

show_failure() {
  local service="$1"

  log "Recent ${service} logs:"
  compose logs --no-color --tail 100 "${service}" >&2 || true
}

# A deployment may intentionally run only a subset of the compose services (for
# example a single app instance on a 2 GB host). The update therefore restarts
# exactly what is already running instead of assuming the full two-instance layout.
running_services() {
  compose ps --services --status running 2>/dev/null || true
}

wait_for_healthy() {
  local service="$1"
  local started_at="${SECONDS}"
  local container_id
  local status

  log "Waiting up to ${HEALTH_TIMEOUT_SECONDS}s for ${service} to become healthy..."

  while (( SECONDS - started_at < HEALTH_TIMEOUT_SECONDS )); do
    container_id="$(compose ps --all -q "${service}")"

    if [[ -n "${container_id}" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"

      case "${status}" in
        healthy)
          log "${service} is healthy."
          return 0
          ;;
        running)
          # nginx ships without a healthcheck, so a running container is the
          # strongest signal available; the stack health is verified after it starts.
          log "${service} is running."
          return 0
          ;;
        exited|dead)
          show_failure "${service}"
          return 1
          ;;
      esac
    fi

    sleep "${HEALTH_POLL_SECONDS}"
  done

  show_failure "${service}"
  return 1
}

update_instance() {
  local service="$1"

  log "Replacing ${service}..."
  if ! compose up -d --no-deps --force-recreate "${service}"; then
    show_failure "${service}"
    compose stop "${service}" || true
    fail "Docker Compose could not replace ${service}. The healthy peer remains running."
  fi

  if ! wait_for_healthy "${service}"; then
    log "${service} did not become healthy; stopping it so Nginx can use the other instance."
    compose stop "${service}" || true
    fail "Rolling update stopped at ${service}. The healthy peer remains running."
  fi
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed or not in PATH."
docker compose version >/dev/null 2>&1 || fail "the Docker Compose plugin is unavailable."

case "${HEALTH_TIMEOUT_SECONDS}" in
  ''|*[!0-9]*) fail "UPDATE_HEALTH_TIMEOUT_SECONDS must be a positive integer." ;;
esac

case "${HEALTH_POLL_SECONDS}" in
  ''|*[!0-9]*) fail "UPDATE_HEALTH_POLL_SECONDS must be a positive integer." ;;
esac

(( HEALTH_TIMEOUT_SECONDS > 0 )) || fail "UPDATE_HEALTH_TIMEOUT_SECONDS must be greater than zero."
(( HEALTH_POLL_SECONDS > 0 )) || fail "UPDATE_HEALTH_POLL_SECONDS must be greater than zero."

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  fail "another update appears to be running (${LOCK_DIR} exists)."
fi
trap cleanup EXIT

cd "${DEPLOY_DIR}"

log "Validating the Compose configuration..."
compose config --quiet

readonly RUNNING_SERVICES="$(running_services)"
[[ -n "${RUNNING_SERVICES}" ]] || fail "no services are running; start the stack before updating."

log "Services currently running: $(echo "${RUNNING_SERVICES}" | tr '\n' ' ')"

readonly APP_SERVICES="$(echo "${RUNNING_SERVICES}" | grep -E '^(app-|nginx$)' || true)"
[[ -n "${APP_SERVICES}" ]] || fail "no application or nginx service is running."

for service in ${APP_SERVICES}; do
  [[ "${service}" == "nginx" ]] && continue
  wait_for_healthy "${service}" || fail "${service} is not healthy; update aborted before making changes."
done

log "Pulling application images..."
compose pull migrate ${APP_SERVICES}

log "Running database migrations..."
compose run --rm migrate

for service in ${APP_SERVICES}; do
  update_instance "${service}"
done

log "Rolling update completed successfully."
compose ps

if [[ "${PRUNE_OLD_IMAGES:-0}" == "1" ]]; then
  log "Pruning unused images..."
  docker image prune -f
fi
