# YourHonor AI

> **Version 1.2.0**

A legal education AI platform for law students. Draft documents, analyze cases, research legal concepts — all from your browser.

---

## What You Need

- A computer running **macOS**, **Windows**, or **Linux**
- **Docker Desktop** (free) — we'll install this
- An **OpenRouter API key** (free credits on signup) — we'll get this

---

## Step 0: Download the App

1. Open your browser and go to: `https://github.com/sikijs/YourHonor-AI`
2. Click the green **"Code"** button near the top right
3. In the dropdown, click **"Download ZIP"**
4. Find the downloaded file in your Downloads folder — it will be named `YourHonor-AI-main.zip`
5. **Double-click the ZIP file** to unzip it (or right-click → "Extract All" on Windows)
6. A new folder called `YourHonor-AI-main` will appear
7. Move the folder to a location of your choice

> **No GitHub account needed. No sign-up required.**

---

## Step 1: Install Docker Desktop

**Mac:**
1. Go to https://www.docker.com/products/docker-desktop/
2. Click **"Download for Mac"**
3. Open the downloaded `.dmg` file
4. Drag the Docker icon into your Applications folder
5. Open Docker from Applications (you may need to approve it in System Settings → Privacy & Security)
6. Wait until the **Docker whale icon** appears in the **top menu bar** (the bar at the very top of your screen with the Apple logo, clock, and WiFi icon). This means Docker is ready.

**Windows:**
1. Go to https://www.docker.com/products/docker-desktop/
2. Click **"Download for Windows"**
3. Run the installer (check "Use WSL 2 instead of Hyper-V" if asked)
4. Restart your computer when prompted
5. Open Docker Desktop from the Start menu
6. Wait until the Docker whale icon appears in your system tray (bottom-right corner of your screen)

**Linux (Ubuntu/Debian):**
Open a terminal (`Ctrl + Alt + T`) and run:
```
sudo apt update
sudo apt install docker.io docker-compose-v2
sudo systemctl start docker
```

---

## Step 2: Get Your OpenRouter API Key (Required)

1. Go to https://openrouter.ai/keys
2. Click **"Sign Up"** at the top right — use your email, Google, or GitHub
3. Once logged in, click the **"[+ Create Key]"** button near the top
4. A long key starting with `sk-or-v1-` will appear. Click the **clipboard icon** next to it to copy it to your clipboard
5. Go to https://openrouter.ai/settings/credits and click **"Add Credits"** — the minimum is **$5**
6. This lasts thousands of responses — every AI feature uses Qwen3-14B, a paid model

---

## Step 3: Run the Setup Script

**Mac:** Double-click **`setup.command`** inside your app folder.

**Windows:** Double-click **`setup.bat`**.

**Linux:** Open a terminal and run:
```
bash scripts/setup-linux.sh
```

The script will guide you through two prompts:

1. **OpenRouter API key** — paste the key from Step 2
2. **CourtListener token (optional)** — the script explains what CourtListener is and how to get a free token. Press Enter to skip if you don't need it.

The script creates your settings file automatically. No manual file editing needed.

---

## Step 4: Start the App

**Mac:** Double-click **`🟢 Start YourHonor AI.command`**.

**Windows:** Double-click **`🟢 Start YourHonor AI.bat`**.

**Linux:** Open a terminal and run:
```
bash scripts/start-linux.sh
```

The app will download the latest pre-built images and start. When you see:
```
YourHonor AI is running at http://localhost:8000
```
the app is ready.

> **Port 8000 already in use?** The app will automatically try 8001, 8002, etc., and show you the correct address.
>
> **First time?** The initial download takes about 30-60 seconds. Subsequent starts are instant.

> **Tip for frequent use:** Drag `🟢 Start YourHonor AI.command` to your Dock (Mac) or pin `🟢 Start YourHonor AI.bat` to your taskbar (Windows) for one-click access. Do the same for `🔴 Stop YourHonor AI.command`.

---

## Step 5: Open the App

1. Open your web browser (Chrome, Edge, Safari, Firefox)
2. Go to **http://localhost:8000** (or the port shown when you started the app)
3. Click **"Sign Up"** to create an account
4. You're in! Start by clicking **"Chat"** in the top menu

---

## Step 6: Stop the App

**Mac:** Double-click **`🔴 Stop YourHonor AI.command`** (from your app folder or Dock shortcut).

**Windows:** Double-click **`🔴 Stop YourHonor AI.bat`**.

**Linux:** Open a terminal and run:
```
bash scripts/stop-linux.sh
```

The app will shut down. You can close the browser tab.

---

## Troubleshooting

**"Port 8000 is already in use"**
The app will automatically pick a different port (8001, 8002, etc.). Look for the address shown in the startup message.

**"docker: command not found"**
Docker Desktop is not installed or not running. Go back to Step 1 and make sure Docker is open and the whale icon is showing.

**"OpenRouter API key is invalid"**
Your key may have expired or was copied incorrectly. Go back to Step 2 and generate a new key.

**`setup.command` or `🟢 Start YourHonor AI.command` opens in TextEdit instead of running**
Right-click the `.command` file → "Open With" → "Terminal (default)" → tick "Always Open With".

**`setup.command` (Mac) or `setup.bat` (Windows) is blocked**

**macOS:**
1. Press **Cmd+Space** to open Spotlight
2. Type `Terminal` and press **Enter**
3. Copy the line below (**including the space at the end**) and paste it into the Terminal window:
```bash
xattr -dr com.apple.quarantine 
```
4. In Finder, locate your **YourHonor-AI-main** folder. Click and hold the folder, **drag it into the Terminal window**, and **drop it right after the space** — the folder's full path appears next to the command
5. Press **Enter**
6. Now double-click `setup.command` to run it

**Windows:**
1. Right-click **setup.bat**
2. Click **Properties**
3. If you see an **Unblock** checkbox at the bottom, check it
4. Click **OK**
5. Now double-click **setup.bat** to run it

If SmartScreen still shows a warning, click **More info** then **Run anyway**.

**The app is slow on the first request**
The AI model takes 60-90 seconds to warm up. Just wait — subsequent responses will be faster.

**Still stuck?** Contact your instructor for help.
