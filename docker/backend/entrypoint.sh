#!/bin/sh
set -e
cd /var/www/html

[ -f .env ] || cp .env.example .env

# `artisan serve` lets backend/.env win over container env vars, so write the
# Docker-specific settings (DOTENV_<KEY> in compose.yaml) into .env on every start.
for key in $(env | sed -n 's/^DOTENV_\([A-Z0-9_]*\)=.*/\1/p'); do
    value=$(printenv "DOTENV_$key" || true)
    escaped=$(printf '%s' "$value" | sed 's/[&|\\]/\\&/g')
    if grep -qE "^#? ?${key}=" .env; then
        sed -i -E "s|^#? ?${key}=.*|${key}=${escaped}|" .env
    else
        printf '%s=%s\n' "$key" "$value" >> .env
    fi
done

composer install --no-interaction --prefer-dist --no-progress

grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force

php artisan migrate --force

# Seed demo data only when the database is empty, so local changes survive restarts.
if ! php -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); exit(App\Models\User::query()->exists() ? 0 : 1);'; then
    php artisan db:seed --force
fi

[ -e public/storage ] || php artisan storage:link

exec "$@"
