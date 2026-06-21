# SecurePass 🔐 — Setup, Keys & Deployment Guide

This guide describes how to run SecurePass locally, configure all cryptographic and payment API keys, set up local webhook tunneling, and deploy the application to production on Vercel.

---

## 🔑 1. Environment Variables Config

Create a `.env.local` file at the root of the project. Here is the complete list of environment variables required:

```env
# ----------------------------------------------------
# Supabase Configuration
# ----------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-client-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key

# ----------------------------------------------------
# Cryptographic Audit Trail Signing Keys (Ed25519)
# ----------------------------------------------------
# Private key used by the server to sign audit logs. Keep this strictly secret.
SERVER_SIGNING_PRIVATE_KEY=686eaee9cd881ee5fde7638b6bc9c80a87a143e86e1e7f5e1f9bb8eea779582e
# Public key used by clients to verify signatures. Safe to expose publicly.
NEXT_PUBLIC_SERVER_SIGNING_PUBLIC_KEY=74dfce2e3fc80bd5ffce8d4a7c8ce073153ae10fee84cc5e7070ebd88c5bfdaf

# ----------------------------------------------------
# Razorpay Configuration
# ----------------------------------------------------
# API Keys generated from Razorpay Dashboard (Settings -> API Keys)
RAZORPAY_KEY_ID=rzp_test_yourKeyId
RAZORPAY_KEY_SECRET=yourRazorpayKeySecret
# Random secure secret string created by you when registering the Webhook
RAZORPAY_WEBHOOK_SECRET=yourWebhookVerificationSecret
```

---

## 🗄️ 2. Supabase Database Configuration

1. Log into your [Supabase Dashboard](https://supabase.com).
2. Open your project, click on **SQL Editor** in the left sidebar, and click **New Query**.
3. Copy and run the core schema script located in [supabase/migrations/001_schema.sql](file:///e:/hackathons/SecurePass/supabase/migrations/001_schema.sql).
4. Create another new query, copy and run the payments trigger script located in [supabase/migrations/002_payments.sql](file:///e:/hackathons/SecurePass/supabase/migrations/002_payments.sql).

---

## 💳 3. Razorpay Subscription setup

1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Switch to **Test Mode** (top header toggle) for development.
3. Navigate to **Subscriptions** -> **Plans** -> **Create Plan**.
4. Fill in:
   * **Plan Name**: `SecurePass Enterprise`
   * **Description**: `Enterprise Tier Billing`
   * **Billing Frequency**: `Monthly`
   * **Price**: `₹400` (or custom price)
5. Copy the generated Plan ID (e.g. `plan_L3hF8k9zPaXq`).
6. Update this plan ID in `app/dashboard/page.tsx` line 168 (passed to the API request payload).

---

## 💻 4. Local Running & Webhook Tunneling

Razorpay needs to send payment status webhooks directly to your local server. You must set up a public secure tunnel for webhooks:

### Step 1: Start the Local Next.js Server
```bash
# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
The server will start on [http://localhost:3000](http://localhost:3000).

### Step 2: Establish the Ngrok Tunnel
Open a separate terminal window and run `ngrok` (download from [ngrok.com](https://ngrok.com)):
```bash
ngrok http 3000
```
Ngrok will generate a secure public URL, e.g., `https://abcdef123.ngrok-free.app`.

### Step 3: Register the Webhook in Razorpay
1. Go to your Razorpay Dashboard -> **Settings** -> **Webhooks** -> **Add New Webhook**.
2. Set the **Webhook URL** to:
   `https://<your-ngrok-subdomain>.ngrok-free.app/api/payments/webhook`
3. Enter a custom **Secret** phrase (e.g., `my_secure_webhook_secret_123`) and save this exact string to your `.env.local` as `RAZORPAY_WEBHOOK_SECRET`.
4. Select the following **Active Events**:
   * `subscription.authenticated`
   * `subscription.charged`
   * `subscription.halted`
   * `subscription.cancelled`
5. Save the Webhook config.

---

## 🛸 5. Production Deployment (Vercel)

### Step 1: Push Project to GitHub
Initialize your git repository and push the code to a private GitHub repo.

### Step 2: Connect Vercel
1. Log in to the [Vercel Dashboard](https://vercel.com).
2. Click **Add New** -> **Project** and import your GitHub repository.
3. Under the **Environment Variables** section, paste all values from your `.env.local` file:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY`
   * `SERVER_SIGNING_PRIVATE_KEY`
   * `NEXT_PUBLIC_SERVER_SIGNING_PUBLIC_KEY`
   * `RAZORPAY_KEY_ID`
   * `RAZORPAY_KEY_SECRET`
   * `RAZORPAY_WEBHOOK_SECRET`
4. Click **Deploy**. Vercel will build and launch your production site (e.g. `https://securepass.vercel.app`).

### Step 3: Update Production Webhooks
1. Return to your Razorpay Dashboard -> **Settings** -> **Webhooks**.
2. Click edit or create a new Webhook.
3. Change the Webhook URL to point to your live domain:
   `https://your-production-app.vercel.app/api/payments/webhook`
4. Ensure the webhook secret and active events match.
