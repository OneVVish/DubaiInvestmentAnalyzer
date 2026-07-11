# Scenario logging backend (Google Apps Script)

`Code.gs` is a reference copy of the script that receives every visitor's scenario. It's not part
of the Vite build — it runs entirely inside Google's infrastructure, deployed by hand.

## One-time setup

1. Create a new Google Sheet. Add this exact header row to row 1:

   ```
   Timestamp | City | Region | Country | IP | UserAgent | ScreenSize | Timezone | Language | ScenarioJSON
   ```

2. In the Sheet: **Extensions → Apps Script**. Delete the default `Code.gs` contents and paste in
   this folder's `Code.gs`.
3. **Project Settings (gear icon) → Script Properties → Add script property**: name `ADMIN_SECRET`,
   value = a passphrase you choose. This gates reads — it never appears in the app's source code.
4. **Deploy → New deployment → Select type: Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - (This only allows anonymous *writes* — reads still require the `ADMIN_SECRET` above, checked
     inside the script itself.)
5. Authorize the script when prompted (it needs permission to read/write this one Sheet). Copy the
   resulting `.../exec` URL.
6. In the app's GitHub repo settings, add a repository secret named `VITE_SCENARIO_LOG_URL` with
   that URL. For local development, put the same value in a `.env` file (see `.env.example`).

## Updating the script later

Any time you change `Code.gs` in this repo, paste the updated contents into the Apps Script editor
and create a **new deployment version** (Deploy → Manage deployments → edit → new version) —
editing the source alone doesn't update the live `.../exec` endpoint.
