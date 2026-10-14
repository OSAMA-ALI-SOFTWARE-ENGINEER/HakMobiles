# HAK Wholesales Tracker

Offline-first wholesale tracker. The React app keeps a local SQLite database and syncs to the Laravel API. Stock, profit, and partner balances are calculated from ledger rows.

The API in this repository is Laravel 13 because that is the current release `composer create-project` installs, and it runs on PHP 8.3. The product rules are the ones in [docs/PRD.md](docs/PRD.md).

## Run locally

Local development uses the MySQL database `hak_tracker` on Laragon (`root` with an empty password). Production on Hostinger uses its own MySQL database. Pest tests still use an in-memory SQLite database.

1. From `api`: `php artisan migrate --force` then `php artisan db:seed --force`.
2. Start the API: `php artisan serve` from `api`.
3. Start the screens: `npm run dev` from `app`.
4. Open the Vite URL and sign in with `haseeb@hak.test` / `ChangeMe123!`.

The first login for a super admin asks for an authenticator code. Dev partners are `waseem@hak.test` and `umar@hak.test` with the same password.

## Tests

```bash
php api/artisan test
npm test --prefix app
npm run test:e2e
```

The Vitest golden sample must show sales € 605,00, net profit € 430,00, margin 71.1%, and partner balances +€ 40,00 / −€ 130,00 / +€ 90,00.

## Deploy

Copy `.deploy.env.example` to `.deploy.env` and run `./deploy.sh` from Git Bash. Do not commit `.deploy.env`.
