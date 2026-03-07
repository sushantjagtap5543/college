---
description: Deploy GeoSurePath to AWS Lightsail and Build Android APK
---

# GeoSurePath Deployment Workflow

This workflow will guide you precisely through the steps required to upload your code to GitHub, automatically compile your Android SDK in the cloud, and deploy the entire server infrastructure to your AWS Lightsail Ubuntu 2GB instance.

### Step 1: Push Code to GitHub
You need to commit your local project changes and push them to your repository to trigger the automated building pipelines.

1. Open your terminal in the root `gps-light` folder.
2. Initialize git if you haven't already.
// turbo
git init
3. Add all files to the staging area.
// turbo
git add .
4. Commit exactly what we implemented.
// turbo
git commit -m "Final Polish: Animation Prompts, Admin Toggles, and Port 5023"
5. Link to your GitHub remote repository (Skip if already linked). Replace `<YOUR_REPO_URL>` with your actual URL.
// turbo
git remote add origin <YOUR_REPO_URL>
6. Push the code to the main branch.
// turbo
git push -u origin main

### Step 2: Download the Android APK
The `.github/workflows/build-apk.yml` file I created for you is configured to run automatically the moment you push the code above!

1. Open your GitHub Repository URL in your web browser.
2. Click on the **Actions** tab at the top.
3. You will see a workflow running named "Build GeoSurePath Android APK".
4. Once it finishes (it will display a green checkmark), click on the workflow run.
5. Scroll down to the bottom and download the **GeoSurePath-Release-APK** artifact.
6. Transfer this APK file to your Android Phone and install it to view the Client App!

### Step 3: Setup the AWS Lightsail Configuration
Log into your AWS Console and prepare your physical server instance.

1. Navigate to AWS Lightsail and create a new instance: **Ubuntu 22.04 LTS** (OS Only).
2. Choose the **$10/month plan (2GB RAM, 1 vCPU, 60 GB SSD)**.
3. Name your instance `GeoSurePath-Main` and click "Create instance".
4. Once it is listed as `Running`, open the instance panel and go to the **Networking** tab.
5. Attach a Static IP to your instance.
6. Open the following IPv4 Firewall Ports under IPv4 firewall:
   - **80** (TCP) - HTTP
   - **443** (TCP) - HTTPS
   - **5023** (TCP & UDP) - Custom TCP for GPS Device Ingestion
   - **8080** (TCP) - Custom Internal API (Optional)

### Step 4: Run the Installation Script on the Server
Deploy the code onto your freshly created AWS Lightsail instance seamlessly using the master install shell script.

1. Connect to your instance via the browser-based SSH terminal in AWS Lightsail.
2. Clone your repository (you will need a Personal Access Token if your repository is private).
   `git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git`
3. Enter the project directory:
   `cd YOUR_REPO`
4. Make the master installation script executable:
   `chmod +x install.sh`
5. Run the installation script as sudo:
   `sudo ./install.sh`
6. Wait roughly 5-10 minutes. The script will beautifully install Node, Redis, PostgreSQL, setup all Postgres databases, build the frontend, and launch daemonized PM2 processes!
