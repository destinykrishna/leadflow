#!/usr/bin/env bash
# ==============================================================================
# LeadFlow — MongoDB Automated Backup Script
# Usage: ./scripts/backup-mongodb.sh [target_uri] [output_directory]
# ==============================================================================

set -euo pipefail

TARGET_URI="${1:-${MONGODB_URI:-mongodb://localhost:27017/leadflow}}"
OUTPUT_DIR="${2:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="leadflow_backup_${TIMESTAMP}.archive.gz"
BACKUP_PATH="${OUTPUT_DIR}/${BACKUP_FILENAME}"

mkdir -p "${OUTPUT_DIR}"

# Sanitize URI for logging (mask password)
MASKED_URI=$(echo "${TARGET_URI}" | sed -E 's/:\/\/([^:]+):([^@]+)@/:\/\/\1:***@/')

echo "=========================================="
echo " Starting LeadFlow Database Backup"
echo " Timestamp : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo " Target URI: ${MASKED_URI}"
echo " Archive   : ${BACKUP_PATH}"
echo "=========================================="

if ! command -v mongodump &> /dev/null; then
  echo "ERROR: 'mongodump' command not found. Please install MongoDB Database Tools." >&2
  exit 1
fi

START_TIME=$(date +%s)

mongodump \
  --uri="${TARGET_URI}" \
  --archive="${BACKUP_PATH}" \
  --gzip

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ -f "${BACKUP_PATH}" ]; then
  FILE_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
  
  # Calculate SHA256 checksum if utility available
  if command -v sha256sum &> /dev/null; then
    sha256sum "${BACKUP_PATH}" > "${BACKUP_PATH}.sha256"
    CHECKSUM=$(cut -d' ' -f1 < "${BACKUP_PATH}.sha256")
  elif command -v shasum &> /dev/null; then
    shasum -a 256 "${BACKUP_PATH}" > "${BACKUP_PATH}.sha256"
    CHECKSUM=$(cut -d' ' -f1 < "${BACKUP_PATH}.sha256")
  else
    CHECKSUM="N/A (shasum utility not found)"
  fi

  echo "=========================================="
  echo " ✓ Backup completed successfully!"
  echo " Duration: ${DURATION}s"
  echo " Size    : ${FILE_SIZE}"
  echo " Checksum: ${CHECKSUM}"
  echo " File    : ${BACKUP_PATH}"
  echo "=========================================="
  exit 0
else
  echo "ERROR: Backup archive file was not generated." >&2
  exit 1
fi
