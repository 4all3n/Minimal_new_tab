# GlassOS New Tab ⚡

A glassmorphic Chrome new-tab extension that turns the browser start page into a customizable productivity dashboard. It combines draggable widgets, instant-persist settings, media wallpapers, note and link modals, and a page-wide Pomodoro focus mode.

## ✨ Features

### 🖥️ Core Widgets
* **Clock:** Digital and analog clock modes with 12/24-hour format, AM/PM, and seconds toggles.
* **Pomodoro:** A focus timer with inline editing, start/pause/reset controls, and a page-wide focus state when running.
* **Notes:** Card-based notes with modal editing and smooth open/close transitions.
* **Quick Links:** A responsive shortcuts grid with an add-link modal.
* **Tasks:** A persistent to-do list with checkbox completion and delete actions.

### 🎨 UI & Motion
* **Glassmorphism:** Soft blur, layered transparency, and accent-driven highlights across widgets and dialogs.
* **Focus Mode:** When Pomodoro is active, the page shifts into a full-screen focus treatment instead of only animating the timer card.
* **Polished Modals:** Note and link modals animate in place, stay centered, and remain readable while focus mode is active.
* **Smart Guides:** Edit-mode alignment guides help align widgets while dragging or resizing.

### ⚙️ Customization
* **Backgrounds:** Use the default wallpaper, a local image/video file, a media URL, or a solid color.
* **Wallpaper Fit:** Choose how wallpapers scale with cover, contain, or fill behavior.
* **Theming:** Adjust blur, opacity, accent color, text color, and glass tone.
* **Browser Integration:** Set the tab title and favicon.
* **Persistence:** Widget positions, widget sizes, notes, links, tasks, and settings are stored locally.

---

## 🚀 Installation Guide

Since this is a custom local extension, you will need to load it into Chrome manually via Developer Mode.

1.  **Download or Clone** this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  In the top right corner, toggle **"Developer mode"** to **ON**.
4.  Click the **"Load unpacked"** button in the top left.
5.  Select the folder containing your project files (`newtab.html`, `style.css`, `script.js`, and `manifest.json`).
6.  Open a New Tab and enjoy!

---

## 📂 File Structure & Architecture

This project is built purely with **HTML5, CSS3, and Vanilla JavaScript**—no frameworks required.

* `newtab.html`: The layout shell for the widgets, settings panel, and hidden modals.
* `style.css`: The visual system, widget styling, focus-mode overlays, modal motion, and responsive layout rules.
* `script.js`: The state and interaction layer. Handles rendering, drag/resize math, modal flows, background selection, and persistence.
* `manifest.json`: Chrome extension metadata for the New Tab override.

---

## 🛠️ Technical Highlights

* **No refresh needed for wallpaper changes:** Image, URL, and video wallpapers are rendered immediately in the current tab.
* **File-backed media support:** Local videos are stored in IndexedDB and previewed instantly with a fresh object URL.
* **Responsive focus mode:** Pomodoro now toggles a page-wide visual state instead of only animating the timer card.
* **Drag/resize helpers:** Widgets support dragging, bottom-right resizing, and visual smart alignment guides in edit mode.
* **Smooth interactions:** The UI uses custom easing curves, overlay transitions, and modal handoff logic to avoid jank.