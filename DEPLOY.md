# Deploying MedPet (free tier)

| Piece | Host | Free-tier notes |
|---|---|---|
| PostgreSQL | **Neon** (neon.tech) | 0.5 GB, never expires |
| Backend API + Socket.IO | **Render** web service | Sleeps after 15 min idle; first request takes ~50 s |
| Admin panel | **Render** static site | Always on, global CDN |
| Android app | APK built locally | Sideload / share the file |

The backend bootstraps itself on every start: it runs migrations, creates the
admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if no admin exists, and seeds the
demo catalog (categories, products, offers) plus home content (tips, brands,
testimonials, stores, settings) **only on a brand-new database**. Restarts and
redeploys never duplicate or overwrite data.

## 1. Push the code to GitHub

```powershell
git remote add origin https://github.com/<you>/medpet.git
git push -u origin master
```
Keep the repo **private**. `.env` files are git-ignored.

## 2. Create the database (Neon)

1. Sign up at neon.tech → **New project** → region *AWS Asia Pacific (Singapore)*.
2. Copy the **connection string** (it ends in `?sslmode=require`). That's your `DATABASE_URL`.

## 3. Deploy backend + admin (Render Blueprint)

1. Sign up at render.com with GitHub → **New → Blueprint** → pick the repo. Render reads `render.yaml`.
2. Fill in the prompted values:

| Service | Key | Value |
|---|---|---|
| medpet-api | `DATABASE_URL` | Neon connection string |
| medpet-api | `ADMIN_EMAIL` | your admin login email |
| medpet-api | `ADMIN_PASSWORD` | a strong password (not `admin123`) |
| medpet-api | `CLIENT_URL` | `https://medpet-admin.onrender.com` |
| medpet-api | `PUBLIC_APP_URL` | `https://medpet-api.onrender.com` |
| medpet-api | `MAIL_USERNAME` / `MAIL_FROM_EMAIL` | Gmail address (or leave blank to disable email) |
| medpet-api | `MAIL_PASSWORD` | a **new** Gmail App Password |
| medpet-admin | `VITE_API_URL` | `https://medpet-api.onrender.com/api` |
| medpet-admin | `VITE_MAPPLS_STATIC_KEY` | Mappls web key (for the Live Map tab) |

3. **Apply**. When the API log shows `Fresh database — seeded …` and `MedPet API`, it's live.

> If Render gives a different subdomain (e.g. `medpet-api-x7k2.onrender.com`
> because the name was taken), use the real URLs in `CLIENT_URL`,
> `PUBLIC_APP_URL` and `VITE_API_URL`, then **Manual Deploy** the admin site
> (Vite bakes `VITE_API_URL` in at build time).

In the Mappls console, add the admin site's domain to the key's allowed referrers.

## 4. Verify the deployment

```powershell
cd backend
$env:SMOKE_URL="https://medpet-api.onrender.com"
$env:SMOKE_ADMIN_EMAIL="<ADMIN_EMAIL>"; $env:SMOKE_ADMIN_PASSWORD="<ADMIN_PASSWORD>"
npm run test:smoke
```
It checks health, admin login, seeded catalog + home content, customer
signup → cart → order, admin order view/permissions, and Socket.IO (23 checks).
It leaves one `smoke-*@medpet.test` customer and a cancelled order behind.

Then open the admin site and log in.

## 5. Build the APK

Requires JDK 17 and the Android SDK (both already installed on the dev PC).

```powershell
cd application
.\build-apk.ps1 -ApiUrl https://medpet-api.onrender.com/api
```
Output: `application\MedPet-release.apk` (arm64 + armv7, covers all modern phones).
The script mirrors the app to `C:\mpb\app` and builds there, because the native
build fails on the long OneDrive path. First build ≈ 20 min, later ones are faster.
Copy it to a phone and install (allow "Install unknown apps").

For local testing instead: `-ApiUrl http://<PC-LAN-IP>:5000/api` (same Wi-Fi).

## Free-tier limits to know

- **Cold start**: after 15 min without traffic the API sleeps; the app waits up to 60 s on the first request. A free uptime pinger (e.g. UptimeRobot hitting `/health` every 10 min) keeps it awake — note this uses ~730 of Render's 750 free hours/month, so keep only one always-on service.
- **Uploaded images are not persistent**: Render's free disk is wiped on every deploy/restart, so product images uploaded through the admin panel (`/uploads`) disappear. Use image URLs, or move uploads to a storage service (e.g. Cloudinary free tier) before relying on uploads.
- **Background location / push notifications** work in the APK (it's a native build), subject to the phone granting permissions.
- The APK is signed with the debug keystore — fine for sideloading, not for the Play Store (use `eas build --profile production` for that).
