# AI Hunter — Vercel 上架指南

## 前置作業

### 1. Neon 換 Pooler 連線 URL

Vercel 是 serverless 架構，每個 request 都可能開新連線，直連 Neon 容易超過連線上限。必須改用 Neon 的 **Pooler URL**。

1. 前往 [console.neon.tech](https://console.neon.tech)
2. 選你的 Project → **Connection string**
3. 切換到 **Pooled connection**
4. 複製該 URL（格式為 `...ep-xxx-pooler.region.aws.neon.tech...`）
5. 這個 URL 只用於 Vercel 環境變數，**不要取代 `.env.local`**（本地開發繼續用 direct URL）

---

### 2. Google OAuth 加入 Vercel 網域

1. 前往 [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → 選你的 OAuth 2.0 Client ID
3. 加入以下設定：

**Authorized JavaScript origins**
```
https://你的app.vercel.app
```

**Authorized redirect URIs**
```
https://你的app.vercel.app/api/auth/callback/google
```

> 如果有自訂網域（例如 `aihunter.tw`），兩個地方都要加自訂網域版本。

---

### 3. 產生新的 NEXTAUTH_SECRET（建議）

正式環境建議重新產一組 secret：

```bash
openssl rand -base64 32
```

---

## Vercel 部署步驟

### Step 1：連結 GitHub Repo

1. 前往 [vercel.com](https://vercel.com) → New Project
2. Import 你的 GitHub repo（`AiHunter`）
3. Framework 會自動偵測為 **Next.js**，不需要手動設定

### Step 2：設定環境變數

在 Vercel Dashboard → Settings → Environment Variables 填入以下所有變數：

| 變數名稱 | 說明 | 範例 |
|---|---|---|
| `DATABASE_URL` | Neon **Pooler** URL | `postgresql://user:pass@ep-xxx-pooler...` |
| `NEXTAUTH_URL` | 你的 Vercel 網址 | `https://ai-hunter.vercel.app` |
| `NEXTAUTH_SECRET` | 隨機 base64 字串 | `openssl rand -base64 32` 產生 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `958620...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | `GOCSPX-...` |
| `ANTHROPIC_API_KEY` | Anthropic API Key | `sk-ant-api03-...` |

> `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` 非必填，空白時系統自動使用 mock 資料。

### Step 3：確認 Build 設定

Vercel 會自動讀取 `package.json` 的 build 指令。目前設定為：

```json
"build": "prisma generate && next build"
```

`prisma generate` 已包含在 build 流程中，**不需要額外設定**。

### Step 4：Deploy

點擊 **Deploy**，Vercel 會自動執行：
1. `npm install`
2. `prisma generate`
3. `next build`

### Step 5：初次部署後同步 DB Schema

第一次部署完成後，需要確認資料庫 schema 是最新的。在本機執行：

```bash
# 確保 .env.local 的 DATABASE_URL 連到正式 Neon DB
npx prisma migrate deploy
```

或直接用 `db push`（適合還在快速迭代的階段）：

```bash
npx prisma db push
```

---

## 自訂網域（選填）

1. Vercel Dashboard → Settings → Domains → Add Domain
2. 到你的 DNS 設定加入 Vercel 提供的 CNAME 或 A Record
3. 回到 Google Cloud Console，把自訂網域也加進 Authorized Origins / Redirect URIs
4. 把 Vercel 上的 `NEXTAUTH_URL` 改為自訂網域

---

## 環境一覽

| 環境 | DATABASE_URL | NEXTAUTH_URL |
|---|---|---|
| 本機開發 | Neon direct URL（`.env.local`） | `http://localhost:3000` |
| Vercel Preview | Neon pooler URL | Vercel 自動產生的 preview URL |
| Vercel Production | Neon pooler URL | `https://你的app.vercel.app` |

---

## 注意事項

- `.env.local` 已在 `.gitignore` 中，**不會被上傳到 GitHub**
- 所有 secret 只存在 Vercel 環境變數，不會出現在程式碼中
- Neon free tier 有 0.5 GB 儲存和每月 191.9 計算小時的限制
- Anthropic API 按用量計費，正式上線前建議在 [console.anthropic.com](https://console.anthropic.com) 設定用量上限
