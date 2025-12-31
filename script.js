/**
 * Video Player Library
 * A single-file, framework-agnostic video player supporting YouTube, Vimeo, and MP4
 *
 * @version 1.0.0
 * @license MIT
 */

(function (window) {
  "use strict";

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Extract YouTube video ID from URL
   */
  function extractYouTubeId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Extract Vimeo video ID from URL
   */
  function extractVimeoId(url) {
    const patterns = [/vimeo\.com\/(\d+)/, /vimeo\.com\/.*\/(\d+)/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Check if URL is an MP4 file
   */
  function isMP4(url) {
    return /\.mp4(\?|$)/i.test(url);
  }

  /**
   * Get YouTube thumbnail URL
   */
  function getYouTubeThumbnail(videoId, quality = "maxresdefault") {
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
  }

  /**
   * Get Vimeo thumbnail via oEmbed API
   */
  function getVimeoThumbnail(videoId, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "GET",
      `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`,
      true
    );
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          callback(data.thumbnail_url || null);
        } catch (e) {
          callback(null);
        }
      } else if (xhr.readyState === 4) {
        callback(null);
      }
    };
    xhr.send();
  }

  /**
   * Capture first frame from MP4 video
   */
  function captureMP4Thumbnail(videoUrl, callback) {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    video.onloadedmetadata = function () {
      video.currentTime = 5;
    };

    video.onseeked = function () {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);
        callback(canvas.toDataURL("image/jpeg"));
      } catch (e) {
        callback(null);
      }
    };

    video.onerror = function () {
      callback(null);
    };

    video.src = videoUrl;
  }

  /**
   * Calculate aspect ratio padding
   */
  function getAspectRatioPadding(ratio) {
    const ratios = {
      "16:9": (9 / 16) * 100,
      "4:3": (3 / 4) * 100,
      "1:1": 100,
    };
    return ratios[ratio] || ratios["16:9"];
  }

  // ============================================================================
  // SOURCE DETECTOR
  // ============================================================================

  class SourceDetector {
    static detect(url) {
      if (!url || typeof url !== "string") {
        return { type: null, id: null };
      }

      const youtubeId = extractYouTubeId(url);
      if (youtubeId) {
        return { type: "youtube", id: youtubeId };
      }

      const vimeoId = extractVimeoId(url);
      if (vimeoId) {
        return { type: "vimeo", id: vimeoId };
      }

      if (isMP4(url)) {
        return { type: "mp4", id: url };
      }

      return { type: null, id: null };
    }

    static getThumbnail(source, callback) {
      if (source.type === "youtube" && source.id) {
        callback(getYouTubeThumbnail(source.id));
      } else if (source.type === "vimeo" && source.id) {
        getVimeoThumbnail(source.id, callback);
      } else if (source.type === "mp4" && source.id) {
        captureMP4Thumbnail(source.id, callback);
      } else {
        callback(null);
      }
    }
  }

  // ============================================================================
  // PLAYER MANAGER (SINGLETON)
  // ============================================================================

  class PlayerManager {
    constructor() {
      this.players = new Set();
    }

    static getInstance() {
      if (!PlayerManager.instance) {
        PlayerManager.instance = new PlayerManager();
      }
      return PlayerManager.instance;
    }

    register(player) {
      this.players.add(player);
    }

    unregister(player) {
      this.players.delete(player);
    }

    pauseAll(exceptPlayer) {
      this.players.forEach((player) => {
        // Don't pause autoplay videos - they can play simultaneously
        if (
          player !== exceptPlayer &&
          player.isPlaying &&
          player.isPlaying() &&
          !player.options.autoplay
        ) {
          player.pause();
        }
      });
    }
  }

  // ============================================================================
  // BASE PLAYER INTERFACE
  // ============================================================================

  class BasePlayer {
    constructor(container, source, options) {
      this.container = container;
      this.source = source;
      this.options = options;
      this.isPaused = true;
      this.currentTime = 0;
      this.duration = 0;
      this.volume = options.muted ? 0 : 1;
      this.isMuted = options.muted || false;
      this.callbacks = {};
      this.playerElement = null;
      this.manager = PlayerManager.getInstance();
      this.manager.register(this);
    }

    on(event, callback) {
      if (!this.callbacks[event]) {
        this.callbacks[event] = [];
      }
      this.callbacks[event].push(callback);
    }

    emit(event, data) {
      if (this.callbacks[event]) {
        this.callbacks[event].forEach((callback) => callback(data));
      }
    }

    isPlaying() {
      return !this.isPaused;
    }

    play() {
      // If autoplay is enabled, skip pausing other videos
      if (!this.options.autoplay) {
        this.manager.pauseAll(this);
      }
      this.isPaused = false;
    }

    pause() {
      this.isPaused = true;
    }

    setCurrentTime(time) {
      this.currentTime = time;
    }

    setVolume(volume) {
      this.volume = volume;
      this.isMuted = volume === 0;
    }

    setMuted(muted) {
      this.isMuted = muted;
    }

    getDuration() {
      return this.duration;
    }

    getCurrentTime() {
      return this.currentTime;
    }

    destroy() {
      this.manager.unregister(this);
      this.callbacks = {};
    }
  }

  // ============================================================================
  // YOUTUBE PLAYER
  // ============================================================================

  // YouTube API loading queue
  const youtubeReadyQueue = [];
  let youtubeAPILoading = false;
  let youtubeAPIReady = false;

  function loadYouTubeAPI() {
    if (youtubeAPIReady) return Promise.resolve();
    if (youtubeAPILoading) {
      return new Promise((resolve) => {
        youtubeReadyQueue.push(resolve);
      });
    }

    youtubeAPILoading = true;
    return new Promise((resolve) => {
      const originalCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        youtubeAPIReady = true;
        youtubeAPILoading = false;
        if (originalCallback) originalCallback();
        youtubeReadyQueue.forEach((cb) => cb());
        youtubeReadyQueue.length = 0;
        resolve();
      };

      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    });
  }

  class YouTubePlayer extends BasePlayer {
    constructor(container, source, options) {
      super(container, source, options);
      this.ytPlayer = null;
      this.init();
    }

    init() {
      // Load YouTube IFrame API if not already loaded
      if (window.YT && window.YT.Player) {
        youtubeAPIReady = true;
        this.createPlayer();
      } else {
        loadYouTubeAPI().then(() => {
          this.createPlayer();
        });
      }
    }

    createPlayer() {
      const iframe = document.createElement("div");
      iframe.id =
        "yt-player-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substr(2, 9);
      this.container.appendChild(iframe);

      this.ytPlayer = new window.YT.Player(iframe.id, {
        videoId: this.source.id,
        playerVars: {
          autoplay: this.options.autoplay ? 1 : 0,
          mute: this.options.muted ? 1 : 0,
          controls: 0,
          rel: 0, // Disable related videos/suggestions
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          iv_load_policy: 3, // Hide video annotations
          fs: 0, // Disable YouTube's native fullscreen (we handle it ourselves)
          cc_load_policy: 0, // Disable closed captions by default
        },
        events: {
          onReady: () => {
            this.duration = this.ytPlayer.getDuration();
            this.emit("ready");
            if (this.options.autoplay) {
              this.play();
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              this.isPaused = false;
              this.emit("play");
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              this.isPaused = true;
              this.emit("pause");
            } else if (event.data === window.YT.PlayerState.ENDED) {
              // If loop is enabled, YouTube will handle it automatically via playlist parameter
              // But we still emit the event for consistency
              if (this.options.loop) {
                // YouTube loop is handled by playlist parameter, so video will restart automatically
                this.isPaused = false;
                this.emit("play");
              } else {
                this.isPaused = true;
                this.emit("ended");
              }
            }
          },
          onError: (event) => {
            this.emit("error", event.data);
          },
        },
      });

      this.playerElement = iframe;

      // Update current time periodically
      this.timeUpdateInterval = setInterval(() => {
        if (this.ytPlayer && this.ytPlayer.getCurrentTime) {
          this.currentTime = this.ytPlayer.getCurrentTime();
          this.emit("timeupdate", this.currentTime);
        }
      }, 100);
    }

    play() {
      super.play();
      if (this.ytPlayer && this.ytPlayer.playVideo) {
        this.ytPlayer.playVideo();
      }
    }

    pause() {
      super.pause();
      if (this.ytPlayer && this.ytPlayer.pauseVideo) {
        this.ytPlayer.pauseVideo();
      }
    }

    setCurrentTime(time) {
      super.setCurrentTime(time);
      if (this.ytPlayer && this.ytPlayer.seekTo) {
        this.ytPlayer.seekTo(time, true);
      }
    }

    setVolume(volume) {
      super.setVolume(volume);
      if (this.ytPlayer && this.ytPlayer.setVolume) {
        this.ytPlayer.setVolume(volume * 100);
      }
    }

    setMuted(muted) {
      super.setMuted(muted);
      if (this.ytPlayer) {
        if (muted) {
          this.ytPlayer.mute();
        } else {
          this.ytPlayer.unMute();
        }
      }
    }

    getDuration() {
      if (this.ytPlayer && this.ytPlayer.getDuration) {
        return this.ytPlayer.getDuration();
      }
      return this.duration;
    }

    getCurrentTime() {
      if (this.ytPlayer && this.ytPlayer.getCurrentTime) {
        return this.ytPlayer.getCurrentTime();
      }
      return this.currentTime;
    }

    destroy() {
      if (this.timeUpdateInterval) {
        clearInterval(this.timeUpdateInterval);
      }
      if (this.ytPlayer && this.ytPlayer.destroy) {
        this.ytPlayer.destroy();
      }
      super.destroy();
    }
  }

  // ============================================================================
  // VIMEO PLAYER
  // ============================================================================

  // Vimeo API loading queue
  const vimeoReadyQueue = [];
  let vimeoAPILoading = false;
  let vimeoAPIReady = false;

  function loadVimeoAPI() {
    if (vimeoAPIReady) return Promise.resolve();
    if (vimeoAPILoading) {
      return new Promise((resolve) => {
        vimeoReadyQueue.push(resolve);
      });
    }

    vimeoAPILoading = true;
    return new Promise((resolve) => {
      const tag = document.createElement("script");
      tag.src = "https://player.vimeo.com/api/player.js";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      tag.onload = () => {
        vimeoAPIReady = true;
        vimeoAPILoading = false;
        vimeoReadyQueue.forEach((cb) => cb());
        vimeoReadyQueue.length = 0;
        resolve();
      };

      tag.onerror = () => {
        vimeoAPILoading = false;
        resolve(); // Still try to create player
      };
    });
  }

  class VimeoPlayer extends BasePlayer {
    constructor(container, source, options) {
      super(container, source, options);
      this.vimeoPlayer = null;
      this.init();
    }

    init() {
      // Load Vimeo Player API if not already loaded
      if (window.Vimeo) {
        vimeoAPIReady = true;
        this.createPlayer();
      } else {
        loadVimeoAPI().then(() => {
          this.createPlayer();
        });
      }
    }

    createPlayer() {
      const loopParam = this.options.loop ? "&loop=1" : "";
      const iframe = document.createElement("iframe");
      iframe.src = `https://player.vimeo.com/video/${this.source.id}?autoplay=${
        this.options.autoplay ? 1 : 0
      }&muted=${
        this.options.muted ? 1 : 0
      }&controls=0&api=1&player_id=vimeo-${Date.now()}${loopParam}`;
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      this.container.appendChild(iframe);

      this.vimeoPlayer = new window.Vimeo.Player(iframe);

      this.vimeoPlayer.ready().then(() => {
        this.vimeoPlayer.getDuration().then((duration) => {
          this.duration = duration;
          this.emit("ready");
          if (this.options.autoplay) {
            this.play();
          }
        });
      });

      this.vimeoPlayer.on("play", () => {
        this.isPaused = false;
        this.emit("play");
      });

      this.vimeoPlayer.on("pause", () => {
        this.isPaused = true;
        this.emit("pause");
      });

      this.vimeoPlayer.on("ended", () => {
        // If loop is enabled, restart the video
        if (this.options.loop) {
          this.vimeoPlayer.setCurrentTime(0);
          this.play();
        } else {
          this.isPaused = true;
          this.emit("ended");
        }
      });

      this.vimeoPlayer.on("timeupdate", (data) => {
        this.currentTime = data.seconds;
        this.emit("timeupdate", data.seconds);
      });

      this.vimeoPlayer.on("error", (error) => {
        this.emit("error", error);
      });

      this.playerElement = iframe;
    }

    play() {
      super.play();
      if (this.vimeoPlayer) {
        this.vimeoPlayer.play();
      }
    }

    pause() {
      super.pause();
      if (this.vimeoPlayer) {
        this.vimeoPlayer.pause();
      }
    }

    setCurrentTime(time) {
      super.setCurrentTime(time);
      if (this.vimeoPlayer) {
        this.vimeoPlayer.setCurrentTime(time);
      }
    }

    setVolume(volume) {
      super.setVolume(volume);
      if (this.vimeoPlayer) {
        this.vimeoPlayer.setVolume(volume);
      }
    }

    setMuted(muted) {
      super.setMuted(muted);
      if (this.vimeoPlayer) {
        if (muted) {
          this.vimeoPlayer.setVolume(0);
        } else {
          this.vimeoPlayer.setVolume(this.volume);
        }
      }
    }

    getDuration() {
      if (this.vimeoPlayer) {
        this.vimeoPlayer.getDuration().then((duration) => {
          this.duration = duration;
        });
      }
      return this.duration;
    }

    getCurrentTime() {
      return this.currentTime;
    }

    destroy() {
      if (this.vimeoPlayer) {
        this.vimeoPlayer.unload();
      }
      super.destroy();
    }
  }

  // ============================================================================
  // HTML5 PLAYER
  // ============================================================================

  class HTML5Player extends BasePlayer {
    constructor(container, source, options) {
      super(container, source, options);
      this.videoElement = null;
      this.init();
    }

    init() {
      const video = document.createElement("video");
      video.src = this.source.id;
      video.preload = this.options.autoplay ? "auto" : "metadata";
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      video.muted = this.options.muted || false;
      video.loop = this.options.loop || false;
      video.autoplay = this.options.autoplay || false;
      video.playsInline = true; // Required for autoplay on mobile
      video.setAttribute("playsinline", "true"); // iOS Safari
      video.controls = false;
      this.container.appendChild(video);

      // Handle autoplay
      if (this.options.autoplay) {
        // Try to play immediately
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            // Autoplay was prevented, try again after user interaction
            console.warn("Autoplay prevented:", error);
          });
        }
      }

      video.addEventListener("loadedmetadata", () => {
        this.duration = video.duration;
        this.emit("ready");
        // Ensure autoplay after metadata is loaded
        if (this.options.autoplay && video.paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.warn("Autoplay after metadata load prevented:", error);
            });
          }
        }
      });

      video.addEventListener("canplay", () => {
        // Try autoplay when video can start playing
        if (this.options.autoplay && video.paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.warn("Autoplay after canplay prevented:", error);
            });
          }
        }
      });

      video.addEventListener("play", () => {
        this.isPaused = false;
        this.emit("play");
      });

      video.addEventListener("pause", () => {
        this.isPaused = true;
        this.emit("pause");
      });

      video.addEventListener("ended", () => {
        // If loop is enabled, restart the video
        if (this.options.loop) {
          video.currentTime = 0;
          video.play();
        } else {
          this.isPaused = true;
          this.emit("ended");
        }
      });

      video.addEventListener("timeupdate", () => {
        this.currentTime = video.currentTime;
        this.emit("timeupdate", video.currentTime);
      });

      video.addEventListener("volumechange", () => {
        this.volume = video.volume;
        this.isMuted = video.muted;
      });

      video.addEventListener("error", (e) => {
        this.emit("error", e);
      });

      this.videoElement = video;
      this.playerElement = video;
    }

    play() {
      super.play();
      if (this.videoElement) {
        this.videoElement.play();
      }
    }

    pause() {
      super.pause();
      if (this.videoElement) {
        this.videoElement.pause();
      }
    }

    setCurrentTime(time) {
      super.setCurrentTime(time);
      if (this.videoElement) {
        this.videoElement.currentTime = time;
      }
    }

    setVolume(volume) {
      super.setVolume(volume);
      if (this.videoElement) {
        this.videoElement.volume = volume;
      }
    }

    setMuted(muted) {
      super.setMuted(muted);
      if (this.videoElement) {
        this.videoElement.muted = muted;
      }
    }

    getDuration() {
      if (this.videoElement) {
        return this.videoElement.duration || this.duration;
      }
      return this.duration;
    }

    getCurrentTime() {
      if (this.videoElement) {
        return this.videoElement.currentTime;
      }
      return this.currentTime;
    }

    destroy() {
      if (this.videoElement) {
        this.videoElement.pause();
        this.videoElement.src = "";
        this.videoElement.load();
      }
      super.destroy();
    }
  }

  // ============================================================================
  // UI CONTROLS
  // ============================================================================

  class UIControls {
    constructor(container, player, options) {
      this.container = container;
      this.player = player;
      this.options = options;
      this.controlsElement = null;
      this.playButton = null;
      this.progressBar = null;
      this.progressBarFill = null;
      this.muteButton = null;
      this.fullscreenButton = null;
      this.centerButton = null;
      this.thumbnailElement = null;
      this.thumbnailOverlay = null;
      this.clickOverlay = null;
      this.isDragging = false;
      this.hasPlayedOnce = false; // Track if video has been played at least once
      this.init();
    }

    init() {
      this.createControls();
      this.attachEvents();
      this.setupThumbnail();
      this.setupClickOverlay();
    }

    createControls() {
      // Create controls container with proper semantic structure
      const controls = document.createElement("div");
      controls.className = "vp-controls";
      controls.setAttribute("role", "toolbar");
      controls.setAttribute("aria-label", "Video player controls");
      controls.innerHTML = `
        <div class="vp-progress-container">
          <div class="vp-progress-bar" 
               role="slider" 
               aria-label="Video progress" 
               aria-valuemin="0" 
               aria-valuemax="100" 
               aria-valuenow="0"
               aria-valuetext="0%"
               tabindex="0">
            <div class="vp-progress-fill" aria-hidden="true"></div>
            <div class="vp-progress-handle" aria-hidden="true"></div>
          </div>
        </div>
        <div class="vp-controls-bar" role="group" aria-label="Player controls">
          <button class="vp-btn vp-play-pause" 
                  aria-label="Play video" 
                  aria-pressed="false"
                  type="button">
            <span class="vp-icon-play" aria-hidden="true">â–¶</span>
            <span class="vp-icon-pause" aria-hidden="true">â¸</span>
            <span class="vp-sr-only">Play</span>
          </button>
          <div class="vp-time" role="timer" aria-live="polite" aria-atomic="true">
            <span class="vp-time-current" aria-label="Current time">0:00</span>
            <span class="vp-time-separator" aria-hidden="true">/</span>
            <span class="vp-time-duration" aria-label="Total duration">0:00</span>
          </div>
          <div class="vp-spacer" aria-hidden="true"></div>
          <div class="vp-volume-container" role="group" aria-label="Volume controls">
            <button class="vp-btn vp-mute" 
                    aria-label="Mute audio" 
                    aria-pressed="false"
                    type="button">
              <span class="vp-icon-volume-on" aria-hidden="true">ðŸ”Š</span>
              <span class="vp-icon-volume-off" aria-hidden="true">ðŸ”‡</span>
              <span class="vp-sr-only">Mute</span>
            </button>
            <div class="vp-volume-slider-wrapper">
              <div class="vp-volume-slider" 
                   role="slider" 
                   aria-label="Volume level" 
                   aria-valuemin="0" 
                   aria-valuemax="100"
                   aria-valuenow="100"
                   aria-valuetext="100%"
                   tabindex="0">
                <div class="vp-volume-track" aria-hidden="true"></div>
                <div class="vp-volume-fill" aria-hidden="true"></div>
                <div class="vp-volume-handle" aria-hidden="true"></div>
              </div>
            </div>
          </div>
          <button class="vp-btn vp-fullscreen" 
                  aria-label="Enter fullscreen mode" 
                  type="button">
            <span class="vp-icon-fullscreen" aria-hidden="true">â›¶</span>
            <span class="vp-icon-exit-fullscreen" aria-hidden="true">â›¶</span>
            <span class="vp-sr-only">Fullscreen</span>
          </button>
        </div>
      `;

      // Create center play/pause button if enabled
      const wrapper = this.container.closest(".vp-wrapper");
      if (this.options.showCenterButton) {
        // Mark wrapper as having center button
        if (wrapper) {
          wrapper.classList.add("has-center-button");
        }

        const centerButton = document.createElement("button");
        centerButton.className = "vp-center-button";
        centerButton.setAttribute("aria-label", "Play video");
        centerButton.setAttribute("aria-pressed", "false");
        centerButton.type = "button";
        centerButton.innerHTML = `
          <span class="vp-center-icon-play" aria-hidden="true">â–¶</span>
          <span class="vp-center-icon-pause" aria-hidden="true">â¸</span>
          <span class="vp-sr-only">Play video</span>
        `;
        this.container.appendChild(centerButton);
        this.centerButton = centerButton;
      }

      // Inject styles if CSS file is not loaded
      this.injectStyles();

      this.container.appendChild(controls);
      this.controlsElement = controls;
      this.playButton = controls.querySelector(".vp-play-pause");
      this.progressBar = controls.querySelector(".vp-progress-bar");
      this.progressBarFill = controls.querySelector(".vp-progress-fill");
      this.muteButton = controls.querySelector(".vp-mute");
      this.volumeSlider = controls.querySelector(".vp-volume-slider");
      this.volumeFill = controls.querySelector(".vp-volume-fill");
      this.volumeHandle = controls.querySelector(".vp-volume-handle");
      this.volumeContainer = controls.querySelector(".vp-volume-container");
      this.fullscreenButton = controls.querySelector(".vp-fullscreen");

      // Center button is already appended to container if enabled
    }

    injectStyles() {
      // Check if CSS file is already loaded or styles are injected
      if (
        document.getElementById("vp-styles") ||
        document.querySelector('link[href*="video-player.css"]')
      ) {
        // CSS is already loaded, just set aspect ratio dynamically
        this.setAspectRatio();
        return;
      }

      // Set aspect ratio even if CSS file is not loaded
      this.setAspectRatio();
    }

    setAspectRatio() {
      const wrapper = this.container.closest(".vp-wrapper");
      if (wrapper) {
        wrapper.setAttribute("data-ratio", this.options.ratio || "16:9");
        // Set padding dynamically if CSS file is loaded
        const padding = getAspectRatioPadding(this.options.ratio || "16:9");
        wrapper.style.setProperty("--vp-aspect-padding", padding + "%");
        if (!wrapper.querySelector("::before")) {
          // Fallback: set inline style if CSS pseudo-element doesn't work
          const beforeStyle = document.createElement("style");
          beforeStyle.id = "vp-aspect-" + Date.now();
          beforeStyle.textContent = `
            .vp-wrapper[data-ratio="${this.options.ratio || "16:9"}"]::before {
              padding-bottom: ${padding}% !important;
            }
          `;
          document.head.appendChild(beforeStyle);
        }
      }
    }

    setupThumbnail() {
      const thumbnail = document.createElement("img");
      thumbnail.className = "vp-thumbnail";
      thumbnail.alt = "Video thumbnail";
      this.thumbnailElement = thumbnail;
      this.container.insertBefore(thumbnail, this.container.firstChild);

      const wrapper = this.container.closest(".vp-wrapper");

      // Load thumbnail
      if (this.options.thumbnail) {
        // Mark wrapper as having custom thumbnail
        if (wrapper) {
          wrapper.classList.add("has-custom-thumbnail");
        }

        // Create overlay if overlay option is set
        if (this.options.thumbnailOverlay) {
          const overlay = document.createElement("div");
          overlay.className = "vp-thumbnail-overlay";
          overlay.setAttribute("data-overlay", this.options.thumbnailOverlay);
          this.container.insertBefore(overlay, thumbnail);
          this.thumbnailOverlay = overlay;
        }

        thumbnail.src = this.options.thumbnail;
        thumbnail.onload = () => {
          thumbnail.classList.remove("hidden");
        };
        thumbnail.onerror = () => {
          // Fallback to default thumbnail if custom thumbnail fails to load
          if (wrapper) {
            wrapper.classList.remove("has-custom-thumbnail");
          }
          if (this.thumbnailOverlay) {
            this.thumbnailOverlay.remove();
            this.thumbnailOverlay = null;
          }
          SourceDetector.getThumbnail(this.player.source, (thumbUrl) => {
            if (thumbUrl) {
              thumbnail.src = thumbUrl;
              thumbnail.onload = () => {
                thumbnail.classList.remove("hidden");
              };
            }
          });
        };
      } else {
        SourceDetector.getThumbnail(this.player.source, (thumbUrl) => {
          if (thumbUrl) {
            thumbnail.src = thumbUrl;
            thumbnail.onload = () => {
              thumbnail.classList.remove("hidden");
            };
          }
        });
      }

      // Click thumbnail to play
      thumbnail.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering container click
        this.player.play();
      });
    }

    setupClickOverlay() {
      // Only add click overlay for iframe-based players (YouTube, Vimeo)
      // HTML5 video elements handle clicks natively
      if (
        this.player.source.type === "youtube" ||
        this.player.source.type === "vimeo"
      ) {
        const clickOverlay = document.createElement("div");
        clickOverlay.className = "vp-click-overlay";
        clickOverlay.setAttribute("aria-hidden", "true");
        this.container.appendChild(clickOverlay);
        this.clickOverlay = clickOverlay;

        // Hide overlay when thumbnail is visible
        const hideOverlayWhenThumbnailVisible = () => {
          if (
            this.thumbnailElement &&
            !this.thumbnailElement.classList.contains("hidden")
          ) {
            clickOverlay.style.display = "none";
          } else {
            clickOverlay.style.display = "block";
          }
        };

        // Check initially and on thumbnail visibility changes
        hideOverlayWhenThumbnailVisible();

        // Observe thumbnail visibility changes
        if (this.thumbnailElement) {
          const observer = new MutationObserver(
            hideOverlayWhenThumbnailVisible
          );
          observer.observe(this.thumbnailElement, {
            attributes: true,
            attributeFilter: ["class"],
          });
        }

        // Handle clicks on overlay
        clickOverlay.addEventListener("click", (e) => {
          e.stopPropagation();
          // Only toggle if not clicking on controls or center button
          const isControlClick = e.target.closest(".vp-controls");
          const isCenterButtonClick = e.target.closest(".vp-center-button");

          if (!isControlClick && !isCenterButtonClick) {
            if (this.player.isPaused) {
              this.player.play();
            } else {
              this.player.pause();
            }
          }
        });
      }
    }

    attachEvents() {
      // Play/Pause button
      this.playButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering container click
        if (this.player.isPaused) {
          this.player.play();
        } else {
          this.player.pause();
        }
      });

      // Progress bar
      this.progressBar.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering container click
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const time = percent * this.player.getDuration();
        this.player.setCurrentTime(time);
      });

      // Progress bar drag
      let isDragging = false;
      this.progressBar.addEventListener("mousedown", (e) => {
        isDragging = true;
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const time = percent * this.player.getDuration();
        this.player.setCurrentTime(time);
      });

      document.addEventListener("mousemove", (e) => {
        if (isDragging) {
          const rect = this.progressBar.getBoundingClientRect();
          const percent = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width)
          );
          const time = percent * this.player.getDuration();
          this.player.setCurrentTime(time);
        }
      });

      document.addEventListener("mouseup", () => {
        isDragging = false;
      });

      // Mute button
      this.muteButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering container click
        this.player.setMuted(!this.player.isMuted);
        this.updateMuteButton();
        this.updateVolumeSlider();
      });

      // Volume slider
      if (this.volumeSlider) {
        this.volumeSlider.addEventListener("click", (e) => {
          e.stopPropagation();
          const rect = this.volumeSlider.getBoundingClientRect();
          const percent = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width)
          );
          const volume = percent;
          this.player.setVolume(volume);
          this.player.setMuted(volume === 0);
          this.updateMuteButton();
          this.updateVolumeSlider();
        });

        // Volume slider drag
        let isVolumeDragging = false;
        this.volumeSlider.addEventListener("mousedown", (e) => {
          isVolumeDragging = true;
          e.stopPropagation();
          const rect = this.volumeSlider.getBoundingClientRect();
          const percent = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width)
          );
          const volume = percent;
          this.player.setVolume(volume);
          this.player.setMuted(volume === 0);
          this.updateMuteButton();
          this.updateVolumeSlider();
        });

        const volumeMouseMoveHandler = (e) => {
          if (isVolumeDragging) {
            const rect = this.volumeSlider.getBoundingClientRect();
            const percent = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width)
            );
            const volume = percent;
            this.player.setVolume(volume);
            this.player.setMuted(volume === 0);
            this.updateMuteButton();
            this.updateVolumeSlider();
          }
        };

        const volumeMouseUpHandler = () => {
          isVolumeDragging = false;
        };

        document.addEventListener("mousemove", volumeMouseMoveHandler);
        document.addEventListener("mouseup", volumeMouseUpHandler);

        // Show volume slider on hover
        if (this.volumeContainer) {
          this.volumeContainer.addEventListener("mouseenter", () => {
            if (this.volumeSlider) {
              this.volumeSlider.classList.add("active");
            }
          });
          this.volumeContainer.addEventListener("mouseleave", () => {
            if (this.volumeSlider) {
              this.volumeSlider.classList.remove("active");
            }
          });
        }
      }

      // Fullscreen button
      this.fullscreenButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering container click
        this.toggleFullscreen();
      });

      // Center button click handler
      if (this.centerButton) {
        this.centerButton.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent triggering container click
          if (this.player.isPaused) {
            this.player.play();
          } else {
            this.player.pause();
          }
        });
      }

      // Click anywhere on video to play/pause (except controls)
      this.container.addEventListener("click", (e) => {
        // Only trigger if click is not on controls, thumbnail, or center button
        const isControlClick = e.target.closest(".vp-controls");
        const isThumbnailClick = e.target.closest(".vp-thumbnail");
        const isCenterButtonClick = e.target.closest(".vp-center-button");

        if (!isControlClick && !isThumbnailClick && !isCenterButtonClick) {
          if (this.player.isPaused) {
            this.player.play();
          } else {
            this.player.pause();
          }
        }
      });

      // Stop propagation on controls bar to prevent container click
      if (this.controlsElement) {
        this.controlsElement.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }

      // Keyboard controls
      const wrapper = this.container.closest(".vp-wrapper");
      if (wrapper) {
        wrapper.setAttribute("tabindex", "0");
        wrapper.addEventListener("keydown", (e) => {
          if (
            e.target === wrapper ||
            e.target === this.progressBar ||
            e.target.closest(".vp-controls")
          ) {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              if (this.player.isPaused) {
                this.player.play();
              } else {
                this.player.pause();
              }
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              this.player.setCurrentTime(
                Math.max(0, this.player.getCurrentTime() - 10)
              );
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              this.player.setCurrentTime(
                Math.min(
                  this.player.getDuration(),
                  this.player.getCurrentTime() + 10
                )
              );
            } else if (e.key === "m" || e.key === "M") {
              e.preventDefault();
              this.player.setMuted(!this.player.isMuted);
              this.updateMuteButton();
            } else if (e.key === "f" || e.key === "F") {
              e.preventDefault();
              this.toggleFullscreen();
            }
          }
        });
      }

      // Player events
      this.player.on("play", () => {
        this.hasPlayedOnce = true; // Mark that video has been played
        this.updatePlayButton();
        this.updateCenterButton();
        this.hideThumbnail();
        this.updateControlsVisibility();
        const wrapper = this.container.closest(".vp-wrapper");
        if (wrapper) wrapper.classList.add("playing");
      });

      this.player.on("pause", () => {
        this.updatePlayButton();
        this.updateCenterButton();
        this.updateControlsVisibility();
        const wrapper = this.container.closest(".vp-wrapper");
        if (wrapper) wrapper.classList.remove("playing");
      });

      this.player.on("timeupdate", () => {
        this.updateProgress();
        this.updateTime();
      });

      this.player.on("ready", () => {
        this.updateTime();
        this.updateVolumeSlider();
        if (this.centerButton) {
          this.updateCenterButton();
        }
      });
    }

    updatePlayButton() {
      if (this.player.isPaused) {
        this.playButton.classList.remove("playing");
        this.playButton.setAttribute("aria-label", "Play video");
        this.playButton.setAttribute("aria-pressed", "false");
      } else {
        this.playButton.classList.add("playing");
        this.playButton.setAttribute("aria-label", "Pause video");
        this.playButton.setAttribute("aria-pressed", "true");
      }
    }

    updateMuteButton() {
      if (this.player.isMuted) {
        this.muteButton.classList.add("muted");
        this.muteButton.setAttribute("aria-label", "Unmute audio");
        this.muteButton.setAttribute("aria-pressed", "true");
      } else {
        this.muteButton.classList.remove("muted");
        this.muteButton.setAttribute("aria-label", "Mute audio");
        this.muteButton.setAttribute("aria-pressed", "false");
      }
    }

    updateVolumeSlider() {
      if (this.volumeSlider && this.volumeFill && this.volumeHandle) {
        const volume = this.player.isMuted ? 0 : this.player.volume;
        const percent = volume * 100;
        this.volumeFill.style.width = percent + "%";
        this.volumeHandle.style.left = percent + "%";
        this.volumeSlider.setAttribute("aria-valuenow", Math.round(percent));
      }
    }

    updateVolumeSlider() {
      if (this.volumeSlider && this.volumeFill && this.volumeHandle) {
        const volume = this.player.isMuted ? 0 : this.player.volume;
        const percent = volume * 100;
        this.volumeFill.style.width = percent + "%";
        this.volumeHandle.style.left = percent + "%";
        this.volumeSlider.setAttribute("aria-valuenow", Math.round(percent));
      }
    }

    updateCenterButton() {
      if (this.centerButton) {
        const wrapper = this.container.closest(".vp-wrapper");
        if (this.player.isPaused) {
          if (wrapper) wrapper.classList.remove("playing");
          this.centerButton.setAttribute("aria-label", "Play video");
          this.centerButton.setAttribute("aria-pressed", "false");
        } else {
          if (wrapper) wrapper.classList.add("playing");
          this.centerButton.setAttribute("aria-label", "Pause video");
          this.centerButton.setAttribute("aria-pressed", "true");
        }
      }
    }

    updateProgress() {
      const duration = this.player.getDuration();
      const current = this.player.getCurrentTime();
      if (duration > 0) {
        const percent = (current / duration) * 100;
        const roundedPercent = Math.round(percent);
        this.progressBarFill.style.width = percent + "%";
        this.progressBar.querySelector(".vp-progress-handle").style.left =
          percent + "%";
        // Update ARIA attributes for accessibility
        this.progressBar.setAttribute("aria-valuenow", roundedPercent);
        this.progressBar.setAttribute("aria-valuetext", roundedPercent + "%");
      }
    }

    updateTime() {
      const formatTime = (seconds) => {
        if (!isFinite(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ":" + (secs < 10 ? "0" : "") + secs;
      };

      const currentEl = this.controlsElement.querySelector(".vp-time-current");
      const durationEl =
        this.controlsElement.querySelector(".vp-time-duration");

      if (currentEl) {
        currentEl.textContent = formatTime(this.player.getCurrentTime());
      }
      if (durationEl) {
        durationEl.textContent = formatTime(this.player.getDuration());
      }
    }

    hideThumbnail() {
      if (this.thumbnailElement) {
        this.thumbnailElement.classList.add("hidden");
      }
      if (this.thumbnailOverlay) {
        this.thumbnailOverlay.classList.add("hidden");
      }
      // Show click overlay when thumbnail is hidden (for iframe-based players)
      if (this.clickOverlay) {
        this.clickOverlay.style.display = "block";
      }
    }

    updateControlsVisibility() {
      const wrapper = this.container.closest(".vp-wrapper");
      if (wrapper) {
        if (this.hasPlayedOnce) {
          wrapper.classList.add("has-played");
        } else {
          wrapper.classList.remove("has-played");
        }
      }
    }

    toggleFullscreen() {
      const wrapper = this.container.closest(".vp-wrapper");
      const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      if (!isFullscreen) {
        if (wrapper.requestFullscreen) {
          wrapper.requestFullscreen();
        } else if (wrapper.webkitRequestFullscreen) {
          wrapper.webkitRequestFullscreen();
        } else if (wrapper.mozRequestFullScreen) {
          wrapper.mozRequestFullScreen();
        } else if (wrapper.msRequestFullscreen) {
          wrapper.msRequestFullscreen();
        }
        if (this.fullscreenButton) {
          this.fullscreenButton.setAttribute(
            "aria-label",
            "Exit fullscreen mode"
          );
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
        if (this.fullscreenButton) {
          this.fullscreenButton.setAttribute(
            "aria-label",
            "Enter fullscreen mode"
          );
        }
      }
    }

    destroy() {
      if (this.controlsElement) {
        this.controlsElement.remove();
      }
      if (this.centerButton) {
        this.centerButton.remove();
      }
      if (this.clickOverlay) {
        this.clickOverlay.remove();
      }
      if (this.thumbnailOverlay) {
        this.thumbnailOverlay.remove();
      }
      if (this.thumbnailElement) {
        this.thumbnailElement.remove();
      }
    }
  }

  // ============================================================================
  // VIDEO PLAYER (PUBLIC API)
  // ============================================================================

  class VideoPlayerInstance {
    constructor(container, options) {
      this.container = container;
      this.options = Object.assign(
        {
          ratio: "16:9",
          autoplay: false,
          muted: false,
          loop: false,
          thumbnail: null,
          thumbnailOverlay: null,
          showCenterButton: false,
          hideControls: false,
          title: null,
          description: null,
          uploadDate: null,
        },
        options
      );

      // If autoplay is true, ensure muted and loop are also true
      if (this.options.autoplay) {
        this.options.muted = true;
        this.options.loop = true;
      }

      if (!this.options.src) {
        throw new Error("VideoPlayer: src is required");
      }

      if (!this.options.container) {
        throw new Error("VideoPlayer: container is required");
      }

      // Detect source
      this.source = SourceDetector.detect(this.options.src);
      if (!this.source.type) {
        throw new Error("VideoPlayer: Unsupported video source");
      }

      // Create wrapper with semantic structure
      this.wrapper = document.createElement("figure");
      this.wrapper.className = "vp-wrapper";
      this.wrapper.setAttribute("data-ratio", this.options.ratio || "16:9");
      this.wrapper.setAttribute("role", "region");
      this.wrapper.setAttribute("aria-label", "Video player");
      if (this.options.autoplay) {
        this.wrapper.setAttribute("data-autoplay", "true");
      }
      if (this.options.hideControls || this.options.autoplay) {
        this.wrapper.classList.add("vp-hide-controls");
      }
      this.container.appendChild(this.wrapper);

      // Create player container with semantic structure
      this.playerContainer = document.createElement("div");
      this.playerContainer.className = "vp-container";
      this.playerContainer.setAttribute("role", "application");
      this.playerContainer.setAttribute("aria-label", "Video content");
      this.wrapper.appendChild(this.playerContainer);

      // Create player based on source type
      this.player = this.createPlayer();

      // Create UI controls
      this.uiControls = new UIControls(
        this.playerContainer,
        this.player,
        this.options
      );

      // Handle fullscreen changes
      this.fullscreenHandlers = {
        fullscreenchange: () => {
          if (document.fullscreenElement === this.wrapper) {
            this.wrapper.classList.add("fullscreen");
          } else {
            this.wrapper.classList.remove("fullscreen");
          }
        },
        webkitfullscreenchange: () => {
          if (document.webkitFullscreenElement === this.wrapper) {
            this.wrapper.classList.add("fullscreen");
          } else {
            this.wrapper.classList.remove("fullscreen");
          }
        },
        mozfullscreenchange: () => {
          if (document.mozFullScreenElement === this.wrapper) {
            this.wrapper.classList.add("fullscreen");
          } else {
            this.wrapper.classList.remove("fullscreen");
          }
        },
        MSFullscreenChange: () => {
          if (document.msFullscreenElement === this.wrapper) {
            this.wrapper.classList.add("fullscreen");
          } else {
            this.wrapper.classList.remove("fullscreen");
          }
        },
      };

      document.addEventListener(
        "fullscreenchange",
        this.fullscreenHandlers.fullscreenchange
      );
      document.addEventListener(
        "webkitfullscreenchange",
        this.fullscreenHandlers.webkitfullscreenchange
      );
      document.addEventListener(
        "mozfullscreenchange",
        this.fullscreenHandlers.mozfullscreenchange
      );
      document.addEventListener(
        "MSFullscreenChange",
        this.fullscreenHandlers.MSFullscreenChange
      );
    }

    createPlayer() {
      switch (this.source.type) {
        case "youtube":
          return new YouTubePlayer(
            this.playerContainer,
            this.source,
            this.options
          );
        case "vimeo":
          return new VimeoPlayer(
            this.playerContainer,
            this.source,
            this.options
          );
        case "mp4":
          return new HTML5Player(
            this.playerContainer,
            this.source,
            this.options
          );
        default:
          throw new Error("VideoPlayer: Unsupported player type");
      }
    }

    addStructuredData() {
      // Add schema.org VideoObject structured data for SEO
      const script = document.createElement("script");
      script.type = "application/ld+json";

      const videoData = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: this.options.title || "Video",
        description: this.options.description || "",
        thumbnailUrl: this.options.thumbnail || "",
        uploadDate: this.options.uploadDate || new Date().toISOString(),
        contentUrl: this.options.src,
      };

      if (this.source.type === "youtube") {
        videoData.embedUrl = `https://www.youtube.com/embed/${this.source.id}`;
      } else if (this.source.type === "vimeo") {
        videoData.embedUrl = `https://player.vimeo.com/video/${this.source.id}`;
      }

      script.textContent = JSON.stringify(videoData);
      this.wrapper.appendChild(script);
    }

    play() {
      this.player.play();
    }

    pause() {
      this.player.pause();
    }

    destroy() {
      // Remove fullscreen event listeners
      if (this.fullscreenHandlers) {
        document.removeEventListener(
          "fullscreenchange",
          this.fullscreenHandlers.fullscreenchange
        );
        document.removeEventListener(
          "webkitfullscreenchange",
          this.fullscreenHandlers.webkitfullscreenchange
        );
        document.removeEventListener(
          "mozfullscreenchange",
          this.fullscreenHandlers.mozfullscreenchange
        );
        document.removeEventListener(
          "MSFullscreenChange",
          this.fullscreenHandlers.MSFullscreenChange
        );
      }

      if (this.uiControls) {
        this.uiControls.destroy();
      }
      if (this.player) {
        this.player.destroy();
      }
      if (this.wrapper && this.wrapper.parentNode) {
        this.wrapper.parentNode.removeChild(this.wrapper);
      }
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  window.VideoPlayer = {
    init: function (options) {
      return new VideoPlayerInstance(options.container, options);
    },
  };

  // Auto-initialize players from data attributes
  function autoInitializePlayers() {
    document.querySelectorAll("[video-player]").forEach((el) => {
      // Skip if already initialized
      if (el.dataset.vpInitialized === "true") {
        return;
      }

      // Mark as initialized
      el.dataset.vpInitialized = "true";

      try {
        const autoplay = el.dataset.autoplay === "true";
        VideoPlayer.init({
          container: el,
          src: el.dataset.videoUrl,
          thumbnail: el.dataset.thumbnail || null,
          thumbnailOverlay: el.dataset.thumbnailOverlay || null,
          showCenterButton: el.dataset.centerButton === "true",
          hideControls: el.dataset.hideControls === "true",
          title: el.dataset.title || null,
          description: el.dataset.description || null,
          uploadDate: el.dataset.uploadDate || null,
          ratio: el.dataset.ratio || "16:9",
          autoplay: autoplay,
          muted: autoplay ? true : el.dataset.muted === "true",
          loop: autoplay ? true : false,
        });
      } catch (error) {
        console.error("VideoPlayer initialization error:", error);
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInitializePlayers);
  } else {
    // DOM already loaded
    autoInitializePlayers();
  }

  // Also support MutationObserver for dynamically added elements
  if (window.MutationObserver) {
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            // Element node
            if (node.classList && node.classList.contains("video-player")) {
              autoInitializePlayers();
            } else if (node.querySelectorAll) {
              const players = node.querySelectorAll(
                '.video-player:not([data-vp-initialized="true"])'
              );
              if (players.length > 0) {
                autoInitializePlayers();
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
})(window);
