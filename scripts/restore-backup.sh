#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../api"
php artisan backup:list
php artisan backup:restore --backup=latest --no-interaction
echo "Restore finished. Log in locally and check the dashboard totals."
