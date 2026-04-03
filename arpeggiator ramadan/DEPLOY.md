# Deploy Breaktime - Ramadan Edition so others can try on their phone

## 1. Push your code to GitHub

From your project root (`fun-with-cv-tutorials`):

```bash
git add "arpeggiator ramadan"
git commit -m "Add Breaktime - Ramadan Edition (Arabic theme, lantern, crescent)"
git push origin main
```

(Use your actual branch name if it’s not `main`.)

---

## 2. Host it (required for camera on phones)

The app needs **HTTPS** for the camera to work on phones. Two simple options:

### Option A: GitHub Pages (if this repo is on GitHub)

1. On GitHub: **Settings** → **Pages**.
2. Under **Source**, choose **Deploy from a branch**.
3. Branch: **main** (or your default), folder: **/ (root)**.
4. Save. After a few minutes the site is live at:
   - **https://&lt;your-username&gt;.github.io/fun-with-cv-tutorials/arpeggiator%20ramadan/**

Share that link; people can open it on their phone and allow camera when prompted.

### Option B: Netlify (nice URL, no GitHub Pages config)

1. Go to [netlify.com](https://www.netlify.com) and sign in (or use “Sign up with GitHub”).
2. **Sites** → **Add new site** → **Import an existing project**.
3. Connect **GitHub** and choose **fun-with-cv-tutorials**.
4. **Build settings:**
   - **Base directory:** `arpeggiator ramadan`
   - **Build command:** leave empty (static site)
   - **Publish directory:** `arpeggiator ramadan` (or `.` if base is already that folder)
5. Deploy. Netlify will give a URL like **https://something.netlify.app**. Share that.

(You can later add a custom domain in Netlify if you want.)

---

## 3. Optional: Cleaner URL (no space)

If you want a URL without `%20`, rename the folder and push:

```bash
git mv "arpeggiator ramadan" arpeggiator-ramadan
git commit -m "Rename folder for cleaner URL"
git push origin main
```

Then the GitHub Pages URL becomes:
**https://&lt;your-username&gt;.github.io/fun-with-cv-tutorials/arpeggiator-ramadan/**

---

## Quick checklist for phone users

- Use **HTTPS** (not `http://` and not `file://`).
- Tell them to **allow camera** when the browser asks.
- Works best in **Chrome or Safari** on mobile.
