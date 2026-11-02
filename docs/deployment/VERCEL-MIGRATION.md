# Vercel migration status

The cloud implementation is now in `api/server.ts`, `server/cloud-app.ts`, `server/cloud-db.ts`, `server/cloud-saves.ts`, and the Supabase adapters. Use [VERCEL-SETUP.md](VERCEL-SETUP.md) for database setup, deployment, limitations and verification status.

The original local SQLite server remains available. Cloud deployment is implemented in source but must be configured and smoke-tested on the real services before being considered live.
