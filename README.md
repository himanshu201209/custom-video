# Video Player Library - Quick Start Guide

## 🚀 Installation

### Step 1: Include CSS

```html

<link rel="stylesheet" href="style.css">

<!-- OR from CDN -->

<link rel="stylesheet" href="https://vgm3l2.csb.app/video-player/style.css">

```

### Step 2: Include JavaScript

```html

<script src="script.js"></script>

<!-- OR from CDN -->

<script src="https://vgm3l2.csb.app/video-player/script.js"></script>

```

### Step 3: Add Video Player

```html

<div video-player data-video-url="YOUR_VIDEO_URL"></div>

```

That's it! The player will automatically initialize.

---

## 📋 All Data Attributes Reference

### Required

- `video-player` - Marks element as video player

- `data-video-url` - Video URL (YouTube, Vimeo, or MP4)

### Optional

- `data-thumbnail` - Custom thumbnail URL

- `data-thumbnail-overlay` - Overlay opacity: "10", "20", or "30"

- `data-center-button` - Show center button: "true" or "false"

- `data-hide-controls` - Hide all controls: "true" or "false"

- `data-autoplay` - Autoplay video: "true" or "false"

- `data-ratio` - Aspect ratio: "16:9", "4:3", or "1:1"

- `data-muted` - Start muted: "true" or "false"

- `data-title` - Video title (for SEO)

- `data-description` - Video description (for SEO)

- `data-upload-date` - Upload date in ISO format (for SEO)

---

## 💡 Common Use Cases

### Background Video (Autoplay, Loop, Muted)

```html

<div video-player

     data-video-url="https://youtu.be/VIDEO_ID"

     data-autoplay="true"></div>

```

### Video with Center Button

```html

<div video-player

     data-video-url="https://youtu.be/VIDEO_ID"

     data-center-button="true"></div>

```

### Video with Custom Thumbnail

```html

<div video-player

     data-video-url="https://youtu.be/VIDEO_ID"

     data-thumbnail="https://example.com/thumb.jpg"></div>

```

### Video with Custom Thumbnail + Overlay

```html

<div video-player

     data-video-url="https://youtu.be/VIDEO_ID"

     data-thumbnail="https://example.com/thumb.jpg"

     data-thumbnail-overlay="20"></div>

```

### Hidden Controls

```html

<div video-player

     data-video-url="https://youtu.be/VIDEO_ID"

     data-hide-controls="true"></div>

```

---

## 🎯 Supported Video Sources

- **YouTube**: `youtube.com`, `youtu.be`

- **Vimeo**: `vimeo.com`

- **MP4**: Direct `.mp4` file URLs

---

## ⚡ Auto-Initialization

The library automatically finds and initializes all elements with the `video-player` attribute. No JavaScript code needed!

```html

<!-- This will automatically work -->

<div video-player data-video-url="https://youtu.be/VIDEO_ID"></div>

```

---

## 🎨 Customization

Edit `style.css` to customize:

- Colors

- Button sizes

- Control positions

- Center button appearance

- And more!
