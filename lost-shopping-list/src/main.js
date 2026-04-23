import { GameState } from "./game-state.js";
import { UIController } from "./ui.js";

const STATIC_ASSET_PATHS = {
  desk: "./assets/images/environment/desk.svg",
  "meeting-table": "./assets/images/environment/meeting-table.svg",
  "coffee-machine": "./assets/images/environment/coffee-machine.svg",
  drawer: "./assets/images/environment/drawer.svg",
  printer: "./assets/images/environment/printer.svg",
  plant: "./assets/images/environment/plant.svg",
  folder: "./assets/images/environment/folder.svg",
  counter: "./assets/images/environment/counter.svg",
  cabinet: "./assets/images/environment/cabinet.svg",
  whiteboard: "./assets/images/environment/whiteboard.svg",
  "reception-desk": "./assets/images/environment/reception-desk.svg",
  "meeting-office": "./assets/images/environment/meeting_office.png",
  "woman-office": "./assets/images/environment/woman_office.png"
};

function slugify(value) {
  return (value ?? "english-input-game")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "english-input-game";
}

function getSettingsStorageKey(story) {
  return `english-input-game-settings:${slugify(story.meta?.title ?? story.meta?.caseTitle ?? "game")}`;
}

function getDefaultSettings(story) {
  return {
    difficulty: story.meta.defaultDifficulty ?? story.meta.difficultyModes?.[0]?.id ?? "easy",
    audioRate: story.meta.defaultAudioRate ?? 1,
    audioEnabled: true
  };
}

function loadSettings(story, storageKey) {
  const defaults = getDefaultSettings(story);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaults;
    }

    return {
      ...defaults,
      ...JSON.parse(raw)
    };
  } catch {
    return defaults;
  }
}

function saveSettings(settings, storageKey) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // Ignore storage failures in restrictive browsers.
  }
}

class AudioController {
  constructor() {
    this.enabled = true;
    this.playbackRate = 1;
    this.queueId = 0;
    this.lastLines = [];
    this.lastCallbacks = {};
    this.currentAudio = null;
    this.cachedSources = new Map();
    this.preloadingSources = new Map();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!this.enabled) {
      this.stop();
    }
    return this.enabled;
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    if (this.currentAudio) {
      this.currentAudio.playbackRate = this.playbackRate;
    }
  }

  toggle() {
    return this.setEnabled(!this.enabled);
  }

  stop() {
    this.queueId += 1;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    this.currentAudio = null;
  }

  replay() {
    if (this.lastLines.length > 0) {
      this.playLines(this.lastLines, this.lastCallbacks);
    }
  }

  getSourceCandidates(lineId) {
    return [
      `./assets/audio/dialogue/${lineId}.mp3`,
      `./assets/audio/dialogue/${lineId}.wav`
    ];
  }

  async preloadLine(lineId) {
    if (!lineId) {
      return null;
    }

    if (this.cachedSources.has(lineId)) {
      return this.cachedSources.get(lineId);
    }

    if (this.preloadingSources.has(lineId)) {
      return this.preloadingSources.get(lineId);
    }

    const preloadPromise = (async () => {
      for (const source of this.getSourceCandidates(lineId)) {
        try {
          const response = await fetch(source, { cache: "force-cache" });
          if (!response.ok) {
            continue;
          }

          const blob = await response.blob();
          const cached = {
            src: URL.createObjectURL(blob),
            isObjectUrl: true
          };
          this.cachedSources.set(lineId, cached);
          return cached;
        } catch {
          // Try the next candidate.
        }
      }

      return null;
    })();

    this.preloadingSources.set(lineId, preloadPromise);
    const result = await preloadPromise;
    this.preloadingSources.delete(lineId);
    return result;
  }

  preloadLineIds(lineIds, concurrency = 6) {
    const uniqueLineIds = [...new Set(lineIds.filter(Boolean))];
    if (uniqueLineIds.length === 0) {
      return Promise.resolve();
    }

    const workerCount = Math.min(concurrency, uniqueLineIds.length);
    const workers = Array.from({ length: workerCount }, (_, workerIndex) => (async () => {
      for (let index = workerIndex; index < uniqueLineIds.length; index += workerCount) {
        await this.preloadLine(uniqueLineIds[index]);
      }
    })());

    return Promise.allSettled(workers);
  }

  playLines(lines, callbacks = {}) {
    this.lastLines = lines.map((line) => ({ ...line }));
    this.lastCallbacks = callbacks;
    if (!this.enabled || lines.length === 0) {
      return;
    }

    this.stop();
    const queueId = this.queueId;
    this.runQueue(queueId, this.lastLines, callbacks);
  }

  async runQueue(queueId, lines, callbacks) {
    for (const line of lines) {
      if (!this.enabled || queueId !== this.queueId) {
        return;
      }

      callbacks.onLineStart?.(line);
      await this.playSingle(line.id);

      if (!this.enabled || queueId !== this.queueId) {
        return;
      }

      callbacks.onLineEnd?.(line);
    }

    callbacks.onQueueEnd?.();
  }

  playSingle(lineId) {
    return new Promise((resolve) => {
      const cachedSource = this.cachedSources.get(lineId)?.src;
      const candidates = cachedSource
        ? [cachedSource, ...this.getSourceCandidates(lineId)]
        : this.getSourceCandidates(lineId);

      const trySource = (index) => {
        if (index >= candidates.length) {
          this.currentAudio = null;
          resolve();
          return;
        }

        const audio = new Audio(candidates[index]);
        audio.preload = "auto";
        audio.playbackRate = this.playbackRate;
        this.currentAudio = audio;

        const cleanup = () => {
          audio.removeEventListener("ended", onEnded);
          audio.removeEventListener("error", onError);
        };

        const onEnded = () => {
          cleanup();
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          resolve();
        };

        const onError = () => {
          cleanup();
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          trySource(index + 1);
        };

        audio.addEventListener("ended", onEnded, { once: true });
        audio.addEventListener("error", onError, { once: true });
        audio.play().catch(onError);
      };

      trySource(0);
    });
  }

  dispose() {
    this.stop();
    for (const cached of this.cachedSources.values()) {
      if (cached?.isObjectUrl) {
        URL.revokeObjectURL(cached.src);
      }
    }
    this.cachedSources.clear();
    this.preloadingSources.clear();
  }
}

function renderTextureCircle(scene, key, fillColor) {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(0xffffff, 0);
  graphics.fillRect(0, 0, 72, 72);
  graphics.lineStyle(6, 0xffffff, 0.88);
  graphics.fillStyle(fillColor, 1);
  graphics.fillCircle(36, 36, 24);
  graphics.strokeCircle(36, 36, 24);
  graphics.fillStyle(0xffffff, 0.92);
  graphics.fillCircle(36, 30, 8);
  graphics.generateTexture(key, 72, 72);
  graphics.destroy();
}

function createCollider(scene, group, decor) {
  if (!decor.collider) {
    return;
  }

  const zone = scene.add.zone(decor.x, decor.y, decor.collider.width, decor.collider.height);
  scene.physics.add.existing(zone, true);
  group.add(zone);
}

function createPrompt(scene) {
  const background = scene.add.rectangle(0, 0, 124, 34, 0x102032, 0.88).setStrokeStyle(2, 0xffffff, 0.18);
  const label = scene.add.text(0, 0, "", {
    fontFamily: "Manrope",
    fontSize: "14px",
    fontStyle: "700",
    color: "#ffffff"
  }).setOrigin(0.5);

  const prompt = scene.add.container(0, 0, [background, label]);
  prompt.setDepth(2000);
  prompt.setVisible(false);

  return { prompt, background, label };
}

function createTargetMarkers(scene, story) {
  const markers = new Map();

  for (const interactive of story.interactives) {
    const ring = scene.add.circle(interactive.x, interactive.y, interactive.radius ?? 70, 0xf7c561, 0.12);
    ring.setStrokeStyle(3, 0xf7c561, 0.65);
    ring.setDepth(50);
    ring.setVisible(false);
    scene.tweens.add({
      targets: ring,
      alpha: { from: 0.28, to: 0.85 },
      scale: { from: 0.95, to: 1.08 },
      duration: 1000,
      repeat: -1,
      yoyo: true
    });
    markers.set(interactive.id, ring);
  }

  return markers;
}

function drawWorld(scene, story) {
  const background = scene.add.graphics();
  background.fillStyle(0xe7e1d7, 1);
  background.fillRoundedRect(0, 0, story.world.width, story.world.height, 28);

  for (const zone of story.world.zones) {
    background.fillStyle(Phaser.Display.Color.HexStringToColor(zone.color).color, 1);
    background.fillRoundedRect(zone.x, zone.y, zone.width, zone.height, 24);
    background.lineStyle(2, 0xffffff, 0.7);
    background.strokeRoundedRect(zone.x, zone.y, zone.width, zone.height, 24);
  }

  background.lineStyle(8, 0xffffff, 0.45);
  background.strokeRoundedRect(14, 14, story.world.width - 28, story.world.height - 28, 26);

  for (let x = 60; x < story.world.width - 60; x += 110) {
    for (let y = 56; y < story.world.height - 56; y += 110) {
      background.fillStyle(0xffffff, 0.08);
      background.fillCircle(x, y, 2);
    }
  }
}

function syncTargetMarkers(state, markers) {
  const active = new Set(state.getTargetIds());
  for (const [id, marker] of markers.entries()) {
    marker.setVisible(active.has(id));
  }
}

function getNearestInteractive(player, sprites) {
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const entry of sprites) {
    const distance = Phaser.Math.Distance.Between(player.x, player.y, entry.object.x, entry.object.y);
    if (distance < nearestDistance && distance <= entry.radius) {
      nearest = entry;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function collectAssetSources(story) {
  const sources = new Map(Object.entries(STATIC_ASSET_PATHS));
  const assetIds = [
    ...(story.world?.decor ?? []).map((item) => item.asset),
    ...(story.interactives ?? []).map((item) => item.asset)
  ];

  for (const assetId of assetIds) {
    if (!assetId || sources.has(assetId)) {
      continue;
    }

    if (
      assetId.startsWith("./") ||
      assetId.startsWith("../") ||
      assetId.startsWith("/") ||
      assetId.includes("/")
    ) {
      sources.set(assetId, assetId);
    }
  }

  return sources;
}

function collectAudioLineIds(story) {
  const lineIds = new Set();
  const addLines = (lines = []) => {
    for (const line of lines) {
      if (line?.id) {
        lineIds.add(line.id);
      }
    }
  };

  addLines(story.introLines);

  for (const step of story.steps ?? []) {
    addLines(step.hints);
    addLines(step.wrongInteraction?.lines);
  }

  for (const check of story.comprehensionChecks ?? []) {
    addLines(check.correctLines);
    addLines(check.wrongLines);
  }

  for (const interactive of story.interactives ?? []) {
    for (const response of Object.values(interactive.responses ?? {})) {
      addLines(response.lines);
      for (const variant of response.variants ?? []) {
        addLines(variant);
      }
    }
  }

  return [...lineIds];
}

async function bootstrap() {
  const story = await fetch("./assets/data/story.json").then((response) => response.json());
  const settingsStorageKey = getSettingsStorageKey(story);
  document.title = story.meta?.title ?? "English Input Game";
  const descriptionTag = document.querySelector('meta[name="description"]');
  if (descriptionTag) {
    descriptionTag.setAttribute(
      "content",
      story.meta?.description ?? "A phone-first browser game for learning English through movement, clues, and short conversations."
    );
  }
  const query = new URLSearchParams(window.location.search);
  const state = new GameState(story);
  const ui = new UIController(story);
  const audio = new AudioController();
  const assetSources = collectAssetSources(story);
  const audioLineIds = collectAudioLineIds(story);
  const playerStart = story.world?.playerStart ?? { x: 130, y: 820 };
  let settings = loadSettings(story, settingsStorageKey);
  const touchState = {
    moveX: 0,
    moveY: 0,
    interact: false,
    hint: false
  };
  const joystickElements = {
    base: document.getElementById("joystick-base"),
    knob: document.getElementById("joystick-knob")
  };
  const joystickState = {
    activePointerId: null,
    radius: 36
  };

  let sceneRef = null;

  const applySettings = (nextSettings, { persist = true } = {}) => {
    settings = {
      ...settings,
      ...nextSettings
    };
    audio.setEnabled(settings.audioEnabled);
    audio.setPlaybackRate(settings.audioRate);
    if (persist) {
      saveSettings(settings, settingsStorageKey);
    }
    render();
  };

  const render = () => {
    ui.render(state, settings);
    ui.renderAudioState(audio.enabled);
    if (sceneRef) {
      syncTargetMarkers(state, sceneRef.targetMarkers);
    }
  };

  const showCurrentTask = () => {
    if (!state.started || state.completed) {
      return;
    }

    const step = state.getCurrentStep();
    ui.showMessage({
      kicker: `Step ${state.getCurrentStepIndex() + 1}`,
      title: step.title,
      text: step.instruction
    });
  };

  const maybeShowComprehension = () => {
    const check = state.getPendingComprehensionCheck();
    if (!check) {
      return false;
    }

    ui.showQuestion(check);
    return true;
  };

  const runLines = (lines, options = {}) => {
    if (!lines || lines.length === 0) {
      options.afterQueue?.();
      return;
    }

    if (audio.enabled) {
      audio.playLines(lines, {
        onLineStart: (line) => {
          ui.setDialogueLine(line, story.speakers);
        },
        onLineEnd: () => {
          ui.scheduleSubtitleHide(3000);
        },
        onQueueEnd: () => {
          options.afterQueue?.();
        }
      });
      return;
    }

    ui.setDialogue(lines, story.speakers);
    ui.scheduleSubtitleHide(3000);
    options.afterQueue?.();
  };

  const startCase = () => {
    const lines = state.startCase();
    ui.hideStart();
    ui.hideEnd();
    if (sceneRef) {
      sceneRef.resetPlayerPosition();
      syncTargetMarkers(state, sceneRef.targetMarkers);
    }
    render();
    runLines(lines, {
      afterQueue: () => {
        showCurrentTask();
      }
    });
  };

  const resetCase = () => {
    state.reset();
    audio.stop();
    ui.showStart();
    ui.hideEnd();
    if (sceneRef) {
      sceneRef.resetPlayerPosition();
      syncTargetMarkers(state, sceneRef.targetMarkers);
    }
    render();
  };

  const requestHint = () => {
    const { lines } = state.requestHint();
    render();
    runLines(lines);

    const hintLine = lines?.[lines.length - 1];
    if (hintLine) {
      ui.showMessage({
        kicker: "Hint",
        title: "Try this",
        text: hintLine.text
      });
    }
  };

  const answerComprehension = (checkId, optionId) => {
    const result = state.answerComprehension(checkId, optionId);
    if (!result) {
      return;
    }

    ui.hideQuestion();
    render();
    runLines(result.lines, {
      afterQueue: () => {
        if (!state.completed) {
          showCurrentTask();
        }
      }
    });
  };

  const handleInteraction = (interactiveId) => {
    const result = state.interact(interactiveId);
    if (!result) {
      return;
    }

    if (result.completed) {
      runLines(result.lines, {
        afterQueue: () => {
          render();
        }
      });
      return;
    }

    render();
    runLines(result.lines, {
      afterQueue: () => {
        if (result.stepChanged && !maybeShowComprehension()) {
          showCurrentTask();
        }
      }
    });
  };

  const updateAudioEnabled = (enabled) => {
    applySettings({ audioEnabled: enabled });
  };

  const updateAudioRate = (rate) => {
    applySettings({ audioRate: rate });
  };

  const updateDifficulty = (difficulty) => {
    applySettings({ difficulty });
  };

  applySettings(settings, { persist: false });
  audio.preloadLineIds(audioLineIds);
  window.addEventListener("beforeunload", () => {
    audio.dispose();
  }, { once: true });

  if (query.get("mute") === "1") {
    applySettings({ audioEnabled: false }, { persist: false });
  }

  ui.bindHandlers({
    onStart: startCase,
    onReset: resetCase,
    onInfo: showCurrentTask,
    onHint: requestHint,
    onAudioToggle: () => {
      updateAudioEnabled(!audio.enabled);
    },
    onReplay: () => audio.replay(),
    onWordsViewed: () => {
      state.markCurrentVocabularySeen();
      render();
    },
    onComprehensionAnswer: answerComprehension,
    onDifficultyChange: updateDifficulty,
    onAudioEnabledChange: updateAudioEnabled,
    onAudioRateChange: updateAudioRate
  });

  const resetJoystick = () => {
    joystickState.activePointerId = null;
    touchState.moveX = 0;
    touchState.moveY = 0;
    if (joystickElements.knob) {
      joystickElements.knob.style.transform = "translate(0px, 0px)";
    }
  };

  const updateJoystick = (event) => {
    if (!joystickElements.base || !joystickElements.knob) {
      return;
    }

    const rect = joystickElements.base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const clampedDistance = Math.min(distance, joystickState.radius);
    const angle = Math.atan2(deltaY, deltaX);
    const knobX = Math.cos(angle) * clampedDistance;
    const knobY = Math.sin(angle) * clampedDistance;

    touchState.moveX = knobX / joystickState.radius;
    touchState.moveY = knobY / joystickState.radius;
    joystickElements.knob.style.transform =
      `translate(${knobX}px, ${knobY}px)`;
  };

  if (joystickElements.base) {
    joystickElements.base.addEventListener("pointerdown", (event) => {
      joystickState.activePointerId = event.pointerId;
      joystickElements.base.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });

    joystickElements.base.addEventListener("pointermove", (event) => {
      if (joystickState.activePointerId !== event.pointerId) {
        return;
      }
      updateJoystick(event);
    });

    const releaseJoystick = (event) => {
      if (joystickState.activePointerId !== event.pointerId) {
        return;
      }
      if (joystickElements.base.hasPointerCapture(event.pointerId)) {
        joystickElements.base.releasePointerCapture(event.pointerId);
      }
      resetJoystick();
    };

    joystickElements.base.addEventListener("pointerup", releaseJoystick);
    joystickElements.base.addEventListener("pointercancel", releaseJoystick);
    joystickElements.base.addEventListener("pointerleave", releaseJoystick);
  }

  document.querySelectorAll("[data-touch-action]").forEach((button) => {
    const action = button.getAttribute("data-touch-action");
    button.addEventListener("pointerdown", () => {
      touchState[action] = true;
    });
  });

  class OfficeScene extends Phaser.Scene {
    constructor() {
      super("OfficeScene");
      this.interactiveSprites = [];
      this.targetMarkers = new Map();
    }

    preload() {
      assetSources.forEach((path, key) => {
        this.load.image(key, path);
      });
    }

    create() {
      sceneRef = this;
      drawWorld(this, story);

      this.physics.world.setBounds(0, 0, story.world.width, story.world.height);
      this.cameras.main.setBounds(0, 0, story.world.width, story.world.height);
      this.cameras.main.setBackgroundColor("#d5d9dd");

      const obstacleGroup = this.physics.add.staticGroup();

      for (const decor of story.world.decor) {
        const image = this.add.image(decor.x, decor.y, decor.asset);
        image.setScale(decor.scale ?? 1);
        image.setDepth(decor.y);
        createCollider(this, obstacleGroup, decor);
      }

      renderTextureCircle(this, "player-token", Phaser.Display.Color.HexStringToColor(story.speakers.mia.tokenColor).color);
      this.player = this.physics.add.image(playerStart.x, playerStart.y, "player-token");
      this.player.setCircle(24);
      this.player.setCollideWorldBounds(true);
      this.player.setDepth(this.player.y);

      this.physics.add.collider(this.player, obstacleGroup);

      for (const interactive of story.interactives) {
        let object = null;

        if (interactive.kind === "npc") {
          const speaker = story.speakers[interactive.speakerId];
          const tokenKey = `${interactive.id}-token`;
          renderTextureCircle(this, tokenKey, Phaser.Display.Color.HexStringToColor(speaker.tokenColor).color);
          object = this.add.image(interactive.x, interactive.y, tokenKey).setDepth(interactive.y + 5);
          const label = this.add.text(interactive.x, interactive.y - 42, speaker.name, {
            fontFamily: "Manrope",
            fontSize: "14px",
            fontStyle: "700",
            color: "#1f2431",
            backgroundColor: "#ffffffcc",
            padding: { left: 8, right: 8, top: 3, bottom: 3 }
          }).setOrigin(0.5).setDepth(1200);
          interactive._label = label;
        } else {
          object = this.add.image(interactive.x, interactive.y, interactive.asset);
          object.setScale(interactive.scale ?? 1);
          object.setDepth(interactive.y);
        }

        interactive._object = object;
        this.interactiveSprites.push({
          id: interactive.id,
          object,
          radius: interactive.radius ?? 80,
          data: interactive
        });
      }

      this.targetMarkers = createTargetMarkers(this, story);
      syncTargetMarkers(state, this.targetMarkers);

      const { prompt, background, label } = createPrompt(this);
      this.prompt = prompt;
      this.promptBackground = background;
      this.promptLabel = label;

      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      this.scale.on("resize", this.handleResize, this);
      this.handleResize(this.scale.gameSize);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        interact: Phaser.Input.Keyboard.KeyCodes.E,
        altInteract: Phaser.Input.Keyboard.KeyCodes.SPACE,
        hint: Phaser.Input.Keyboard.KeyCodes.H
      });

      render();
    }

    handleResize(gameSize) {
      const width = gameSize?.width ?? this.scale.width;
      const height = gameSize?.height ?? this.scale.height;
      this.cameras.main.setSize(width, height);
    }

    resetPlayerPosition() {
      if (!this.player) {
        return;
      }
      this.player.setPosition(playerStart.x, playerStart.y);
      this.player.setVelocity(0, 0);
      this.cameras.main.centerOn(playerStart.x, playerStart.y);
    }

    update() {
      const speed = 180;
      let velocityX = touchState.moveX * speed;
      let velocityY = touchState.moveY * speed;

      if (this.cursors.left.isDown || this.keys.left.isDown) {
        velocityX -= speed;
      }
      if (this.cursors.right.isDown || this.keys.right.isDown) {
        velocityX += speed;
      }
      if (this.cursors.up.isDown || this.keys.up.isDown) {
        velocityY -= speed;
      }
      if (this.cursors.down.isDown || this.keys.down.isDown) {
        velocityY += speed;
      }

      this.player.setVelocity(velocityX, velocityY);
      this.player.setDepth(this.player.y);

      for (const interactive of story.interactives) {
        if (interactive._label) {
          interactive._label.setPosition(interactive.x, interactive.y - 42);
        }
      }

      const nearby = getNearestInteractive(this.player, this.interactiveSprites);

      if (nearby) {
        this.prompt.setVisible(true);
        this.promptLabel.setText(nearby.data.label);
        this.promptBackground.width = Math.max(120, this.promptLabel.width + 28);
        this.prompt.setPosition(nearby.object.x, nearby.object.y - 56);
      } else {
        this.prompt.setVisible(false);
      }

      const interactPressed =
        Phaser.Input.Keyboard.JustDown(this.keys.interact) ||
        Phaser.Input.Keyboard.JustDown(this.keys.altInteract) ||
        touchState.interact;

      const hintPressed =
        Phaser.Input.Keyboard.JustDown(this.keys.hint) ||
        touchState.hint;

      if (interactPressed && nearby) {
        handleInteraction(nearby.id);
      }

      if (hintPressed) {
        requestHint();
      }

      touchState.interact = false;
      touchState.hint = false;
    }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "phaser-root",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#d5d9dd",
    physics: {
      default: "arcade",
      arcade: {
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [OfficeScene]
  });

  render();

  if (query.get("autostart") === "1") {
    window.setTimeout(() => {
      startCase();
    }, 200);
  }
}

bootstrap();
