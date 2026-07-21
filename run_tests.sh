#!/bin/bash
#
# Runs every test suite in the repo: the frontend AI evals + unit tests (which drive the real local
# model through the assistant graph), then the backend pytest suite. Used by the pre-commit hook and
# meant to be run by hand to confirm the whole app is healthy. Any failure exits non-zero.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED=0

banner() {
    echo ""
    echo "============================================================"
    echo "  $1"
    echo "============================================================"
}

# --- Frontend: unit tests + AI evals (the evals need a local Ollama running) -----------------
banner "Frontend tests (unit + AI evals)"
if [ ! -d "$REPO_ROOT/frontend/node_modules" ]; then
    echo "  frontend dependencies missing. Run: cd frontend && npm install"
    FAILED=1
else
    ( cd "$REPO_ROOT/frontend" && npm test )
    if [ $? -ne 0 ]; then
        echo ""
        echo "  FAIL: frontend tests did not pass."
        FAILED=1
    else
        echo ""
        echo "  OK: frontend tests passed."
    fi
fi

# --- Backend: pytest (Atlas-backed tests skip themselves if the cluster is unreachable) ------
banner "Backend tests (pytest)"
if ! command -v uv >/dev/null 2>&1; then
    echo "  uv not found. Backend tests need it. Install uv, then: cd backend && make uv_sync"
    FAILED=1
else
    ( cd "$REPO_ROOT/backend" && uv run pytest -q )
    if [ $? -ne 0 ]; then
        echo ""
        echo "  FAIL: backend tests did not pass."
        FAILED=1
    else
        echo ""
        echo "  OK: backend tests passed."
    fi
fi

banner "Summary"
if [ $FAILED -ne 0 ]; then
    echo "  Some tests failed or could not run. See the output above."
    echo ""
    exit 1
fi
echo "  All tests passed."
echo ""
exit 0
