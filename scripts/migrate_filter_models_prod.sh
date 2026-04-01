#!/usr/bin/env bash
set -euo pipefail

# Production migration helper for students_grades.0005_add_filter_models
# Usage:
#   ./scripts/migrate_filter_models_prod.sh
# Optional env:
#   PYTHON_BIN=python3
#   BACKUP_DIR=./data/backups

PYTHON_BIN="${PYTHON_BIN:-python3}"
BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/db_backup_before_filter_models_${TIMESTAMP}.sqlite3"

mkdir -p "${BACKUP_DIR}"

if [[ -f "db.sqlite3" ]]; then
  cp "db.sqlite3" "${BACKUP_FILE}"
  echo "[1/4] SQLite backup created: ${BACKUP_FILE}"
else
  echo "[1/4] db.sqlite3 not found. If production uses PostgreSQL, run pg_dump manually before continue."
fi

echo "[2/4] Checking migration plan..."
"${PYTHON_BIN}" manage.py showmigrations students_grades

echo "[3/4] Applying target migration students_grades.0005_add_filter_models..."
"${PYTHON_BIN}" manage.py migrate students_grades 0005_add_filter_models

echo "[4/4] Verifying migration state..."
"${PYTHON_BIN}" manage.py showmigrations students_grades

echo "Done. If rollback is required:"
echo "  ${PYTHON_BIN} manage.py migrate students_grades 0004"
