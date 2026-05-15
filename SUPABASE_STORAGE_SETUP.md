# Supabase Storage Setup

The GitHub Actions pipelines upload JSON data files to Supabase Storage instead of
committing them to the repo. This keeps the git history clean and avoids branch
protection issues entirely. The frontend fetches from Supabase Storage in production
and falls back to `/public/` for local development.

---

## 1. Create the Storage Bucket

1. Go to your Supabase dashboard → **Storage** → **New bucket**
2. Name it exactly: `pipeline-data`
3. Toggle **Public bucket** ON  
   *(This allows the frontend to fetch files without authentication)*
4. Click **Save**

---

## 2. Verify the Public URL Format

Once the bucket is created, the public URL for any file will be:

```
https://wornbqdvjsohvofeqcrk.supabase.co/storage/v1/object/public/pipeline-data/<filename>
```

For example:
- `https://wornbqdvjsohvofeqcrk.supabase.co/storage/v1/object/public/pipeline-data/evenfield_enriched.json`
- `https://wornbqdvjsohvofeqcrk.supabase.co/storage/v1/object/public/pipeline-data/congressional_enriched.json`
- `https://wornbqdvjsohvofeqcrk.supabase.co/storage/v1/object/public/pipeline-data/lobbying_data.json`

---

## 3. Get the Service Role Key

The upload script uses the **service role key** (not the anon/publishable key).
The service key has full storage write access — it should **never** be used in the frontend.

1. Supabase dashboard → **Project Settings** → **API**
2. Copy the **service_role** key (under "Project API keys")
3. Add it as a GitHub Actions secret (see step 4)

---

## 4. Add GitHub Actions Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret** for each of the following:

| Secret name            | Value                                                                   |
|------------------------|-------------------------------------------------------------------------|
| `ANTHROPIC_API_KEY`    | Your Anthropic API key                                                  |
| `RESEND_API_KEY`       | Your Resend API key (for email alerts)                                  |
| `SUPABASE_URL`         | `https://wornbqdvjsohvofeqcrk.supabase.co`                             |
| `SUPABASE_SERVICE_KEY` | The **service_role** key from step 3 above                              |
| `VERCEL_DEPLOY_HOOK`   | Your Vercel deploy hook URL (see step 5)                                |

---

## 5. Get the Vercel Deploy Hook

The pipelines trigger a Vercel rebuild after uploading new data.

1. Vercel dashboard → your project → **Settings** → **Git** → **Deploy Hooks**
2. Create a hook named `GitHub Actions Pipeline` targeting the `main` branch
3. Copy the hook URL — it looks like:  
   `https://api.vercel.com/v1/integrations/deploy/prj_.../...`
4. Add it as the `VERCEL_DEPLOY_HOOK` GitHub Actions secret

---

## 6. Add the Storage URL to Vercel Environment Variables

The frontend reads `VITE_SUPABASE_STORAGE_URL` at build time. You need to add this
in the Vercel dashboard so production builds pick it up:

1. Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add:
   - **Key:** `VITE_SUPABASE_STORAGE_URL`
   - **Value:** `https://wornbqdvjsohvofeqcrk.supabase.co/storage/v1/object/public/pipeline-data`
   - **Environment:** Production (and Preview if you want)
3. Redeploy

---

## 7. Test the Upload Manually (Optional)

Before relying on GitHub Actions, you can test the upload locally:

```bash
# Set env vars
export SUPABASE_URL=https://wornbqdvjsohvofeqcrk.supabase.co
export SUPABASE_SERVICE_KEY=<your-service-role-key>

# Install supabase client if needed
pip install supabase

# Upload a file
python scripts/upload_to_supabase.py evenfield_enriched.json
```

You should see `OK  evenfield_enriched.json  (XX.X KB)` if it works.

---

## Architecture Summary

```
GitHub Actions (every 2h / 4h / daily)
  → runs Python pipeline scripts
  → uploads *.json to Supabase Storage (pipeline-data bucket)
  → triggers Vercel deploy hook

Vercel build
  → fetches VITE_SUPABASE_STORAGE_URL from env
  → bundles frontend

User's browser
  → fetches JSON from Supabase Storage (fast, CDN-backed)
  → falls back to /public/ if VITE_SUPABASE_STORAGE_URL is not set
```

No JSON files are ever committed to the git repository.
