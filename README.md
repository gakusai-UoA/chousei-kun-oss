# Chosei-kun (OSS)

An open-source scheduling application built with Next.js and Cloudflare D1.

## Prerequisites

- Node.js (v18 or later recommended)
- Cloudflare Account
- Wrangler CLI (`npm install -g wrangler`)

## Getting Started

### 1. Simple Setup Script (Recommended)

You can run the interactive setup script which will automatically install dependencies, set up the Cloudflare D1 database, and deploy the application.

```bash
./setup.sh
```

### 1 (Manual). Install Dependencies

```bash
pnpm install
```

### 2. Configure Cloudflare D1 Database

First, create a new D1 database:

```bash
pnpm exec wrangler d1 create chosei-kun-db
```

This command will output a `database_id`. Copy this ID and paste it into the `d1_databases` section in `wrangler.jsonc` replacing `<YOUR_D1_DATABASE_ID>`.

もし、大学のポータルシステム（Campus Square等）から時間割をインポートする機能を有効にしたい場合は、以下の環境変数を設定してください。

```plaintext
NEXT_PUBLIC_ENABLE_CAMPUS_SQUARE=true
CAMPUS_SQUARE_BASE_URL=https://your-university-domain/campusweb
CAMPUS_SQUARE_LOGIN_WFID=nwf_PTW0000002_login
CAMPUS_SQUARE_CALENDAR_FLOWID=POW2401000-flow
CAMPUS_SQUARE_TIMEZONE_OFFSET=+09:00
```

### 3. Run Database Migrations

Apply the existing migrations to your local and remote databases:

```bash
# For local development
pnpm exec wrangler d1 migrations apply chosei-kun-db --local

# For remote deployment
pnpm exec wrangler d1 migrations apply chosei-kun-db --remote
```

### 4. Local Development

Run the Next.js development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

Deploy the application to Cloudflare Workers using OpenNext:

```bash
pnpm run deploy
```

> Note: You need to be logged into Wrangler (`wrangler login`) to deploy.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
