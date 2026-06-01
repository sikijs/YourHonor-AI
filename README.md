# YourHonor AI

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
7. **Move this folder** somewhere easy to find, like your Desktop or Documents folder

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
5. **Save it somewhere safe** (paste into a temporary text file) — you won't be able to see it again

> **No credit card needed.** New accounts get free credits to start.

---

## Step 3: Get Your CourtListener Token (Optional)

The app includes 20 landmark US Supreme Court cases pre-loaded (Gideon, Miranda, Roe v. Wade, etc.). If you only need those, skip this step.

If you want to search for any other case (a case your professor assigned, a state court case, etc.), get a free token:

1. Go to https://www.courtlistener.com/
2. Click **"Register"** at the top right and create a free account
3. After confirming your email, log in
4. Click your username at the top right, then **"Profile"**
5. Scroll down to the **"API"** section
6. You'll see a long string labeled **"Token"** — click the **copy icon** next to it
7. Paste this token somewhere safe alongside your OpenRouter key

> The free tier allows 5 requests per minute and 50 requests per hour — plenty for classroom use.

---

## Step 4: Set Up the Settings File

1. Open your app folder (`YourHonor-AI-main`)
2. Inside the folder, create a new file called **`.env`**:
   - **Mac:** Open TextEdit → File → New → type the two lines below → Save as `.env` in your app folder
   - **Windows:** Right-click in the folder → New → Text Document → open it → type the two lines below → Save
3. Type exactly these two lines:
   ```
   OPENROUTER_API_KEY=your-openrouter-api-key
   COURTLISTENER_TOKEN=your-courtlistener-token
   ```
4. Replace `your-openrouter-api-key` with the key you copied in Step 2. No spaces. It should look like:
   ```
   OPENROUTER_API_KEY=sk-or-v1-abc123def456...
   ```
5. If you got a CourtListener token in Step 3, replace `your-courtlistener-token` with it too
6. Save and close the file

---

## Step 5: Start the App

### On Mac

**Double-click** the `start.command` file inside your app folder. A Terminal window will open and the app will start. When you see `YourHonor AI is running at http://localhost:8000`, the app is ready.

> If `start.command` opens in TextEdit instead of running, right-click it → "Open With" → "Terminal (default)" → tick "Always Open With".

### On Windows

**Double-click** the `start.bat` file inside your app folder. A Command Prompt window will open and the app will start. You'll see a message telling you it's ready.

### On Linux

Open a terminal and run:
```
bash scripts/start-linux.sh
```

---

## Step 6: Open the App

1. Open your web browser (Chrome, Edge, Safari, Firefox)
2. Go to **http://localhost:8000**
3. Click **"Sign Up"** to create an account
4. You're in! Start by clicking **"Chat"** in the top menu

---

## Step 7: Create a Desktop Shortcut (Optional but Recommended)

So you don't have to open the app folder every time:

**On Mac:**
Drag `start.command` from your app folder onto the Desktop. That's it — double-click it next time.

**On Windows:**
Right-click `start.bat` → "Send to" → "Desktop (create shortcut)".

**Do the same for `stop.command` or `stop.bat`** so you can shut down from your Desktop too.

---

## Step 8: Stop the App

**On Mac:** Double-click `stop.command` (from your Desktop shortcut or the app folder).

**On Windows:** Double-click `stop.bat`.

**On Linux:** Open a terminal and run:
```
bash scripts/stop-linux.sh
```

The app will shut down. You can close the browser tab.

---

## Troubleshooting

**"Port 8000 is already in use"**
Another program is using port 8000. Close that program first, or restart your computer.

**"docker: command not found"**
Docker Desktop is not installed or not running. Go back to Step 1 and make sure Docker is open and the whale icon is showing.

**"OpenRouter API key is invalid"**
Your key may have expired or was copied incorrectly. Go back to Step 2 and generate a new key.

**`start.command` opens in TextEdit instead of running**
Right-click `start.command` → "Open With" → "Terminal (default)" → tick "Always Open With".

**The app is slow on the first request**
The AI model takes 60-90 seconds to warm up. Just wait — subsequent responses will be faster.

**Still stuck?** Contact your instructor for help.
