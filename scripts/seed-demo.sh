#!/usr/bin/env bash
#
# Allturf CRM — One-command demo data seeder
#
# Usage:
#   ./scripts/seed-demo.sh             # import all + verify
#   ./scripts/seed-demo.sh --step=16   # import only step 16 + verify
#   ./scripts/seed-demo.sh --skip-verify  # import without verification
#   ./scripts/seed-demo.sh --verify-only  # verify only (no import)
#
set -euo pipefail
cd "$(dirname "$0")/.."

STEP_FLAG=""
SKIP_VERIFY=false
VERIFY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --step=*) STEP_FLAG="$arg" ;;
    --skip-verify) SKIP_VERIFY=true ;;
    --verify-only) VERIFY_ONLY=true ;;
    --help|-h)
      echo "Usage: $0 [--step=N] [--skip-verify] [--verify-only]"
      echo ""
      echo "Options:"
      echo "  --step=N        Run only import step N"
      echo "  --skip-verify   Skip verification after import"
      echo "  --verify-only   Run verification only (no import)"
      echo ""
      echo "Valid steps: 1, 2, 4, 5, 6, 7, 8, 9, 11, 14, 16, 17, 18, 19, 20, 21, 22"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Run with --help for usage"
      exit 1
      ;;
  esac
done

# Check .env.local exists
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found in $(pwd)"
  echo "Create it with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            Allturf CRM — Demo Data Pipeline                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Import
if [ "$VERIFY_ONLY" = false ]; then
  echo "▸ Running import... $STEP_FLAG"
  echo ""
  npx tsx scripts/import-demo-data.ts $STEP_FLAG
  echo ""
fi

# Verify
if [ "$SKIP_VERIFY" = false ]; then
  echo "▸ Running verification..."
  echo ""
  npx tsx scripts/verify-demo-data.ts
fi

echo "Done."
