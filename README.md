# Spiken

Telegram bot used to keep track of user balances and consumed products.

## Prerequisites

- npm (for running the bot)
- docker (for running a local database)

## Running the bot

1. Set environment variables by creating a copy of [.env.template](backend/.env.template)

2. Start a local database

```bash
docker compose up db -d
```

3. Install dependencies

```bash
npm i
```

4. Start the bot

```bash
npm start
```
