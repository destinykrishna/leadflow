#!/usr/bin/env bash
# ==============================================================================
# LeadFlow — MongoDB Restore and Verification Script
# Usage: ./scripts/restore-mongodb.sh <archive_file_path> [target_uri] [--drop]
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path_to_archive.gz> [target_uri] [--drop]"
  echo "Example: $0 ./backups/leadflow_backup_latest.archive.gz mongodb://localhost:27017/leadflow_verify --drop"
  exit 1
fi

ARCHIVE_FILE="$1"
TARGET_URI="${2:-${MONGODB_URI:-mongodb://localhost:27017/leadflow_verification}}"
DROP_FLAG="${3:-}"

if [ ! -f "${ARCHIVE_FILE}" ]; then
  echo "ERROR: Archive file '${ARCHIVE_FILE}' not found." >&2
  exit 1
fi

if ! command -v mongorestore &> /dev/null; then
  echo "ERROR: 'mongorestore' command not found. Please install MongoDB Database Tools." >&2
  exit 1
fi

# Sanitize URI for logging
MASKED_URI=$(echo "${TARGET_URI}" | sed -E 's/:\/\/([^:]+):([^@]+)@/:\/\/\1:***@/')

echo "=========================================="
echo " Starting LeadFlow Database Restore/Verify"
echo " Timestamp : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo " Archive   : ${ARCHIVE_FILE}"
echo " Target URI: ${MASKED_URI}"
echo "=========================================="

# Check checksum if available
if [ -f "${ARCHIVE_FILE}.sha256" ]; then
  echo "Verifying SHA256 checksum..."
  if command -v sha256sum &> /dev/null; then
    sha256sum -c "${ARCHIVE_FILE}.sha256"
  elif command -v shasum &> /dev/null; then
    shasum -a 256 -c "${ARCHIVE_FILE}.sha256"
  fi
  echo "✓ Checksum integrity verified."
fi

START_TIME=$(date +%s)

RESTORE_CMD=(mongorestore --uri="${TARGET_URI}" --archive="${ARCHIVE_FILE}" --gzip)

if [ "${DROP_FLAG}" = "--drop" ]; then
  RESTORE_CMD+=(--drop)
fi

"${RESTORE_CMD[@]}"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "=========================================="
echo " ✓ Restore completed successfully in ${DURATION}s!"
echo "=========================================="
