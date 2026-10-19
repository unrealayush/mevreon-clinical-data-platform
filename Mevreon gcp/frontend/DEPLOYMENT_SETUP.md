# Mevreon Pipeline - Setup & Deployment Guide

## 🚀 Quick Start for New Users

### For End Users (Customers)

If you're opening the app in a browser:

1. **On your PC / Device:** Open the application link
2. **Login Screen:** You'll see a login form asking for AWS credentials
3. **Enter Credentials:**
   - Access Key ID: (provided by your administrator)
   - Secret Access Key: (provided by your administrator)
4. **Click "Secure Clinical Login"**
5. **Your credentials are saved locally** - next time you visit, you won't need to enter them again

**Note:** Each device/browser needs credentials entered once. This is secure and normal.

---

## 🔧 For Administrators - Setting Up Auto-Login

To make the app work seamlessly for your customers WITHOUT requiring manual credential entry:

### Step 1: Get Your AWS Credentials

If you don't have AWS credentials yet:
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Create an IAM user or use an existing one
3. Assign policy: **AmazonS3ReadOnlyAccess** (or custom read-only policy for specific buckets)
4. Generate "Access Keys" and save:
   - Access Key ID
   - Secret Access Key

### Step 2: Add Credentials to Project

1. **Navigate to the frontend directory:**
   ```bash
   cd "Mevreon aws/frontend"
   ```

2. **Create `.env.production` file:**
   ```bash
   cp .env.example .env.production
   ```

3. **Edit `.env.production` and add your actual AWS credentials:**
   ```
   VITE_AWS_ACCESS_KEY_ID=AKIAIOSFODXXXXXX7
   VITE_AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiXXXXXX
   ```

4. **Save the file** (This file is git-ignored for security)

### Step 3: Build for Deployment

```bash
# Install dependencies (if not already done)
npm install

# Build for production
npm run build

# The build will embed your AWS credentials
```

### Step 4: Deploy to S3

```bash
# Deploy the built app
aws s3 sync dist/ s3://mevreon-pipeline-deployment --delete

# Make index.html public for proper redirects
aws s3 cp s3://mevreon-pipeline-deployment/index.html s3://mevreon-pipeline-deployment/index.html --content-type "text/html" --cache-control "max-age=0" --metadata-directive REPLACE
```

**Now your customers can visit the app and it will auto-login!** 🎉

---

## 🏥 Required S3 Buckets

The app needs read access to these S3 buckets (adjust if using different names):
- `bedrock-pipeline-raw-ayush`
- `bedrock-pipeline-staging-ayush`
- `bedrock-pipeline-processed-ayush`
- `bedrock-pipeline-curated-ayush`
- `bedrock-pipeline-quarantine-ayush`

Ensure your IAM user has `s3:GetObject` and `s3:ListBucket` permissions.

---

## 📊 How It Works

### Local Development (with manual login)
```
User opens app
  → Login screen appears
  → User enters AWS credentials
  → App stores in browser localStorage
  → Credentials persist on that device
  → App connects to S3 and loads data
```

### Deployed with Environment Variables (auto-login)
```
User opens app
  → App automatically uses embedded AWS credentials
  → No login screen needed
  → App connects to S3 immediately
  → Loads all patient data
```

---

## 🔒 Security Notes

**DO:**
- ✅ Use IAM user with minimal permissions (S3 read-only)
- ✅ Rotate access keys regularly (AWS best practice)
- ✅ Add `.env.production` to `.gitignore` (never commit secrets!)
- ✅ Use different credentials for dev/prod if possible

**DON'T:**
- ❌ Don't commit `.env.production` to Git
- ❌ Don't share Secret Access Keys via email
- ❌ Don't use root AWS account credentials
- ❌ Don't write credentials in code comments

**Note:** With environment variables embedded in the build, credentials are visible in browser source code. This is acceptable for read-only S3 access with user-scoped keys. For production HIPAA systems, consider:
- AWS Cognito for authentication
- Pre-signed S3 URLs with expiration
- Backend API as proxy to S3

---

## ⚠️ Troubleshooting

### "Connection failed" Error
```
✓ Verify credentials in .env.production are correct
✓ Check AWS IAM console for matching Access Key
✓ Ensure user has S3 permissions
✓ Wait ~2 minutes after creating new IAM access keys
```

### Data not loading on other PCs
```
Method 1: Manual Login (works immediately)
  - Each PC enters credentials once
  - Works for customer PCs without rebuilding

Method 2: Auto-Login (requires rebuild)
  - Update .env.production with credentials
  - Run: npm run build
  - Deploy: aws s3 sync dist/ s3://bucket
```

### Website shows blank/404
```
✓ Check that index.html was deployed to S3
✓ Verify S3 bucket is configured as website
✓ Clear browser cache (Ctrl+Shift+Delete)
✓ Check browser console for errors (F12)
```

### CORS errors in browser console
```
Solution: Add to S3 bucket CORS configuration:
{
  "AllowedHeaders": ["Authorization", "*"],
  "AllowedMethods": ["GET", "HEAD", "PUT"],
  "AllowedOrigins": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}
```

---

## 📁 Project Structure

```
frontend/
├── .env.example          ← Copy to .env.production
├── .env.production       ← ADD YOUR CREDENTIALS HERE (git-ignored)
├── src/
│   └── App.jsx          ← Main app (check for import.meta.env usage)
├── dist/                ← Built files (created by npm run build)
├── vite.config.js       ← Build configuration
└── package.json         ← Dependencies
```

---

## 🎯 Summary Checklist

- [ ] Copy `.env.example` → `.env.production`
- [ ] Add AWS credentials to `.env.production`
- [ ] Run `npm install` (if needed)
- [ ] Run `npm run build`
- [ ] Verify `dist/` folder created
- [ ] Deploy: `aws s3 sync dist/ s3://bucket --delete`
- [ ] Test app in browser
- [ ] Share app link with customers

Done! Your customers can now access the app without entering credentials. 🎉

---

## Support

For AWS credential issues:
- [AWS IAM Documentation](https://docs.aws.amazon.com/iam/)
- [AWS S3 Access Control](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-overview.html)

For app-specific issues, check the browser console (F12) for error messages.
