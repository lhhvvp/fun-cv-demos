# JavaScript MediaPipe Tracking Tutorial Series: Introduction & Syllabus

Welcome to the JavaScript MediaPipe Tracking Tutorial Series!

This series is designed to be both practical and engaging. Each chapter walks you through building a focused, minimal demo so you can learn by doing. We keep the walkthroughs simple and approachable, but always end with ideas for how to go further—pointing you to real, more advanced demos in this repo. Our goal: give you all the information you need, keep things chatty and transparent so you know why we make each choice, and make learning fun and motivating!

## How This Series Works
- **Each chapter = a hands-on walkthrough.** You’ll build a mini-project from scratch, learning the core concept step by step.
- **Spotlight on real demos.** At the end of each chapter, we’ll show you how the concept is used in a more advanced demo, and suggest features you could add.
- **Optional challenges.** Try extending your mini-project with ideas from the demo!
- **Reasoning and transparency.** We’ll always explain why we structure things the way we do, and encourage you to experiment.

## Syllabus

**Chapter 1: Getting Started with MediaPipe and Three.js**  
[Read Chapter 1 →](tutorial-01-basic.md)
- Walkthrough: Build a minimal hand tracking demo (webcam + draw landmarks)
- Why use MediaPipe and Three.js?
- How to structure your project for learning and tinkering
- **Spotlight:** [Hand Tracking 101](../hand-tracking-101) — See how you can add more features, UI, and polish

**Chapter 2: Advanced Real-Time 3D Tracking and Gestures**  
[Read Chapter 2 →](tutorial-02-advanced.md)
- Walkthrough: Add gesture recognition (e.g., pinch) and 3D visualization
- How to keep your code clean and efficient
- **Spotlight:**
  - [Shape Creator](../shape-creator) — Multiple shapes, color changes, more gestures
  - [3D Editor](../3d-editor) — Real-time editing of 3D objects with hand gestures

**Chapter 3: Multi-Hand, Multi-Body & Multi-User Support**  
*Coming soon!*
- Walkthrough: Track and visualize multiple hands or bodies
- How to handle edge cases and user switching
- **Spotlight:** [The Floor is Lava](../the-floor-is-lava) — See how full-body tracking powers a game

**Chapter 4: Interactivity & User Feedback**  
*Coming soon!*
- Walkthrough: Trigger actions and animate objects based on gestures/poses
- How to add sound, UI, and feedback
- **Spotlight:**
  - [3D Model Playground](../3d-model-playground) — Voice + gesture control
  - [Arpeggiator](../arpeggiator) — Make music with your hands
  - [Handcrafted Shader](../handcrafted-shader) — Control shaders with gestures and voice

**Chapter 5: Performance Optimization**  
*Coming soon!*
- Walkthrough: Make your app smooth and responsive
- How to handle high-res video and mobile devices
- **Spotlight:** [Planet Explorer](../planet-explorer) — Large scenes, smooth navigation

**Chapter 6: Accessibility & Usability**  
*Coming soon!*
- Walkthrough: Add keyboard/alternative input, improve accessibility
- How to guide users and make your app welcoming
- **Spotlight:** [SeeFood](../seefood) — Simple UI and feedback

**Chapter 7: Going Further**  
*Coming soon!*
- Walkthrough: Combine tracking with other sensors, export data, or integrate with other apps
- **Spotlight:**
  - [Whirlpool Camera](../whirlpool-camera) — Creative webcam effects
  - [Chin-Up Game](../chinup) — Fitness/game project with pose and gesture

---
This structure is intentional: you’ll always have a clear, simple starting point, and a path to more advanced, real-world projects. We want you to understand not just the “how,” but the “why”—and to have fun along the way!

- [Chapter 1: Getting Started](tutorial-01-basic.md)
- [Chapter 2: Advanced 3D Tracking](tutorial-03-advanced.md)
- Chapters 3–7: Coming soon!

---

## Appendix: Ways to Follow Along and Experiment

There are several ways you can set up your environment to follow along with these tutorials. Choose the one that fits your style and needs best!

- **JSFiddle / CodePen / StackBlitz:**
  - Great for quick experiments and sharing code. Just copy the HTML and JavaScript from the tutorial, add the CDN links for MediaPipe and Three.js, and you’re ready to go. [JSFiddle webcam access works, but you may need to open in a new tab and allow permissions.]
- **VSCode + Live Server Extension:**
  - Recommended for most beginners and anyone who wants to build larger projects. You get instant reloads, easy file management, and a real project structure. Just open your folder and right-click `index.html` to “Open with Live Server.”
- **Local Files in Your Browser:**
  - You can open `index.html` directly in your browser, but some features (like webcam access) may be blocked due to security restrictions. Using a local server (like Live Server or Python’s `http.server`) is better.
- **GitHub Codespaces / Gitpod:**
  - Cloud-based development environments that let you code in VSCode in your browser, with full access to files and terminals. Great for working from anywhere.
- **Replit:**
  - Another cloud-based option, easy to set up and share, with support for HTML/JS projects.

**Tip:** If you’re just starting out, try JSFiddle for instant feedback, then move to VSCode + Live Server for a more robust workflow as your projects grow.

> The goal is to make it as easy as possible for you to experiment, learn, and share your creations—no matter what tools you prefer!
