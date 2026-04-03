#  Blob Tracking in Python

This Python script turns your webcam or a video file into a sci-fi Heads-Up Display (HUD). It detects moving objects (motion detection) and draws boxes, lines, and "glitch" effects around them.

---

## 🛠️ Step 1: Install Requirements

Before running the script, you need to have Python installed. You also need two specific libraries (add-ons) to handle the video and math.

Open your **Command Prompt** (Windows) or **Terminal** (Mac/Linux) and run this command:

```bash
pip install opencv-python numpy
```

---

## 📷 Step 2: How to Run (Webcam Mode)

This is the easiest way to use the tracker. It will automatically scan your computer for cameras.

1.  Open your terminal/command prompt.
2.  Navigate to the folder where you saved `blob_tracker.py`.
3.  Run the following command:

```bash
python blob_tracker.py
```

**What happens next:**
1.  The script will look for cameras.
2.  It will ask you to select a camera (type the number, e.g., `0`, and hit Enter).
3.  It will ask you to pick a **Color Style** (type `1` through `6` and hit Enter).
4.  A window will pop up showing your camera feed with the effects applied.

---

## 🎬 Step 3: How to Run (Video File Mode)

If you have a pre-recorded video (like an `.mp4` or `.avi` file) that you want to process:

1.  Put your video file in the same folder as the script.
2.  Run the command with the filename:

```bash
python blob_tracker.py my_video.mp4
```

**Note:** The script will automatically save a processed version of your video (e.g., `my_video_tracked.mp4`) when it finishes.

---

## 🎨 The Color Styles

When the script asks for a style, here is what the numbers mean:

1.  **Tactical Green:** Looks like night vision or a military display.
2.  **Phosphor Amber:** Looks like an old 1980s monochrome monitor.
3.  **Cyber Cyan:** Bright blue/yellow "Tron" style.
4.  **Red Alert:** Aggressive red colors.
5.  **Synthwave:** Neon pinks and purples.
6.  **Monochrome:** Black and white.

---

## 🎮 Controls & Features

*   **To Quit:** Press the **`q`** key on your keyboard while the video window is active to stop the program.
*   **The "Glitch" Effect:** Sometimes, a tracking box will turn into a pixelated "checkerboard" pattern. This is intentional! It is a visual effect called "dithering" that happens randomly to make it look retro.
*   **The Network Lines:** If two objects are close to each other, a line will draw between them to show they are "connected."

