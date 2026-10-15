# 🚀 Complete Free Hosting Guide — Feynman AI System

## Architecture Overview

```
[User Browser]
      │
      ▼
[Vercel] — Frontend (React)
      │  REACT_APP_API_URL
      ▼
[Render] — Backend (Node.js / Express)
      │  NLI_SERVICE_URL
      ▼
[HuggingFace Spaces] — NLI Service (Python Flask + DeBERTa)
```

> [!IMPORTANT]
> **Deploy in this exact order:** HuggingFace → Render → Vercel.
> Each step needs the URL from the previous one.

---

## ✅ Pre-Deployment Checklist

Make sure your repo is on **GitHub** first:
```bash
# In d:\KDU\IST\feynman-system
git init           # if not already done
git add .
git commit -m "prepare for deployment"
git remote add origin https://github.com/YOUR_USERNAME/feynman-system.git
git push -u origin main
```

> [!NOTE]
> Your `.gitignore` should already exclude `.env` files. Double check before pushing!

---

## STEP 1 — Deploy NLI Service → HuggingFace Spaces (FREE, has GPU-class CPU)

### Why HuggingFace?
HuggingFace Spaces with Docker SDK gives you **16 GB RAM** on free tier — perfect for DeBERTa + torch.

### Files already created for you:
- [`nli-service/Dockerfile`](file:///d:/KDU/IST/feynman-system/nli-service/Dockerfile)
- [`nli-service/README.md`](file:///d:/KDU/IST/feynman-system/nli-service/README.md) (HF metadata card)
- [`nli-service/requirements.txt`](file:///d:/KDU/IST/feynman-system/nli-service/requirements.txt) (updated with flask-cors, gunicorn)

### Steps:

1. Go to **https://huggingface.co/new-space**
2. Fill in:
   - **Space name**: `feynman-nli-service`
   - **SDK**: `Docker`
   - **Visibility**: `Public`
3. Click **Create Space**
4. In the new Space, click **Files** tab → **Add file** → **Upload files**
5. Upload ONLY these 3 files from `nli-service/`:
   - `app.py`
   - `requirements.txt`
   - `Dockerfile`
   - `README.md`
6. Click **Commit changes**
7. Wait ~5-10 minutes for build (it downloads DeBERTa during build)
8. Once it shows **Running** (green dot), your NLI URL is:
   ```
   https://YOUR_HF_USERNAME-feynman-nli-service.hf.space
   ```
9. **Test it:**
   ```bash
   curl -X POST https://YOUR_HF_USERNAME-feynman-nli-service.hf.space/verify \
     -H "Content-Type: application/json" \
     -d '{"original":"The sky is blue.","claims":["The sky is blue"]}'
   ```
   You should get a JSON response with `support_score`.

> [!TIP]
> HuggingFace Spaces sleep after 48h of inactivity. You can wake it up by visiting the Space URL in a browser before using the app.

---

## STEP 2 — Deploy Backend → Render (FREE, Node.js)

### Files already created:
- [`backend/Dockerfile`](file:///d:/KDU/IST/feynman-system/backend/Dockerfile) (optional, Render auto-detects Node)
- [`backend/package.json`](file:///d:/KDU/IST/feynman-system/backend/package.json) — now has `"start": "node server.js"`

### Steps:

1. Go to **https://render.com** → Sign up with GitHub
2. Click **New** → **Web Service**
3. Connect your GitHub repo: `feynman-system`
4. Configure:
   | Field | Value |
   |-------|-------|
   | **Name** | `feynman-backend` |
   | **Root Directory** | `backend` |
   | **Environment** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `node server.js` |
   | **Instance Type** | `Free` |

5. Scroll down to **Environment Variables** and add:
   | Key | Value |
   |-----|-------|
   | `GEMINI_API_KEY` | your Gemini key |
   | `GROQ_API_KEY` | your Groq key |
   | `NLI_SERVICE_URL` | `https://YOUR_HF_USERNAME-feynman-nli-service.hf.space` |

6. Click **Create Web Service**
7. Wait ~2-3 minutes for deploy
8. Your backend URL will be:
   ```
   https://feynman-backend.onrender.com
   ```

> [!WARNING]
> Render free tier **sleeps after 15 minutes** of inactivity. First request after sleep takes ~30 seconds. This is normal on free tier.

---

## STEP 3 — Deploy Frontend → Vercel (FREE, always-on, global CDN)

### Steps:

1. Go to **https://vercel.com** → Sign up with GitHub
2. Click **Add New** → **Project**
3. Import your `feynman-system` repo
4. Configure:
   | Field | Value |
   |-------|-------|
   | **Root Directory** | `frontend` |
   | **Framework Preset** | `Create React App` |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `build` |

5. Expand **Environment Variables** and add:
   | Key | Value |
   |-----|-------|
   | `REACT_APP_API_URL` | `https://feynman-backend.onrender.com` |

6. Click **Deploy**
7. Wait ~2 minutes
8. Your live URL will be:
   ```
   https://feynman-system.vercel.app
   ```

---

## STEP 4 — Update CORS on Backend (Important!)

Once you have your Vercel URL, update your backend's `server.js` to allow only your frontend:

```js
// In backend/server.js — replace:
app.use(cors());

// With:
app.use(cors({
  origin: [
    "https://feynman-system.vercel.app",   // your Vercel URL
    "http://localhost:3000"                 // local dev
  ]
}));
```

Then push to GitHub — Render auto-redeploys.

---

## 📊 Final Free Tier Limits

| Service | Platform | Free Limit | Sleep? |
|---------|----------|-----------|--------|
| Frontend | Vercel | Unlimited | ❌ Never |
| Backend | Render | 750 hrs/month | ✅ 15 min idle |
| NLI Service | HuggingFace | Unlimited (CPU) | ✅ 48h idle |

---

## 🔄 Workflow After Deployment

Every time you push code to GitHub:
- **Vercel** auto-redeploys frontend ✅
- **Render** auto-redeploys backend ✅
- **HuggingFace** — you must manually upload changed files ⚠️

---

## 🛠️ Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Backend 502 on first request | Render cold start | Wait 30s, retry |
| NLI returns 503 | HF Space sleeping | Visit the Space URL to wake it |
| CORS error in browser | Wrong origin in cors() | Add your Vercel URL to cors origins |
| `REACT_APP_API_URL` not working | Missing env var in Vercel | Re-add env var, redeploy |
| NLI build fails on HuggingFace | torch download timeout | Retry the build from HF dashboard |

---

## 💰 Cost Summary

| Item | Cost |
|------|------|
| Vercel (Frontend) | **$0** |
| Render (Backend) | **$0** |
| HuggingFace Spaces (NLI) | **$0** |
| Gemini API | **$0** (free quota) |
| Groq API | **$0** (free quota) |
| **TOTAL** | **$0/month** |
