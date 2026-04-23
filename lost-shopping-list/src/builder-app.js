const STORAGE_KEY = "english-office-builder-draft-v1";
const DEFAULT_CUSTOM_DIR = "./assets/images/custom";

const state = {
  activeTab: "game",
  bootstrap: null,
  story: null,
  templateId: null,
  buildSlug: "",
  provider: "auto",
  generateAudio: true,
  customAssets: {},
  selectedMapTarget: { kind: "interactive", index: 0 },
  validationMessages: [],
  buildResult: null,
  drag: null
};

const dom = {
  templateSelect: document.getElementById("template-select"),
  navButtons: Array.from(document.querySelectorAll(".builder-nav-button")),
  panels: Array.from(document.querySelectorAll(".builder-tab")),
  summaryCards: document.getElementById("summary-cards"),
  previewMeta: document.getElementById("preview-meta"),
  assetLibrary: document.getElementById("asset-library"),
  gameTitleInput: document.getElementById("game-title-input"),
  caseTitleInput: document.getElementById("case-title-input"),
  caseTagInput: document.getElementById("case-tag-input"),
  playerNameInput: document.getElementById("player-name-input"),
  browserAudioSpeedInput: document.getElementById("browser-audio-speed-input"),
  globalNaturalRateInput: document.getElementById("global-natural-rate-input"),
  pregameVocabInput: document.getElementById("pregame-vocab-input"),
  reviewPhrasesInput: document.getElementById("review-phrases-input"),
  introLinesInput: document.getElementById("intro-lines-input"),
  worldWidthInput: document.getElementById("world-width-input"),
  worldHeightInput: document.getElementById("world-height-input"),
  mapStage: document.getElementById("map-stage"),
  mapSelectionEditor: document.getElementById("map-selection-editor"),
  mapItemList: document.getElementById("map-item-list"),
  zonesInput: document.getElementById("zones-input"),
  peopleList: document.getElementById("people-list"),
  interactivesList: document.getElementById("interactives-list"),
  stepsList: document.getElementById("steps-list"),
  checksList: document.getElementById("checks-list"),
  jsonEditor: document.getElementById("json-editor"),
  buildSlugInput: document.getElementById("build-slug-input"),
  providerSelect: document.getElementById("provider-select"),
  buildAudioInput: document.getElementById("build-audio-input"),
  validationList: document.getElementById("validation-list"),
  buildResult: document.getElementById("build-result"),
  voiceOptions: document.getElementById("voice-options")
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function sanitizeFileName(value) {
  const safe = String(value ?? "asset")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || `asset-${Date.now()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function jsonToText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(value) {
  return JSON.parse(value);
}

function parsePipeRows(text, expectedParts) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((cell) => cell.trim());
      while (parts.length < expectedParts) {
        parts.push("");
      }
      return parts.slice(0, expectedParts);
    });
}

function serializePipeRows(rows) {
  return rows.join("\n");
}

function parseVocabularyText(text) {
  return parsePipeRows(text, 3).map(([term, definition, translation]) => ({
    term,
    definition,
    translation
  })).filter((item) => item.term || item.definition || item.translation);
}

function serializeVocabulary(items = []) {
  return serializePipeRows(
    items.map((item) => [item.term ?? "", item.definition ?? "", item.translation ?? ""].join(" | "))
  );
}

function parseReviewPhrasesText(text) {
  return parsePipeRows(text, 3).map(([speaker, lineText, translation]) => ({
    speaker,
    text: lineText,
    translation
  })).filter((item) => item.speaker || item.text || item.translation);
}

function serializeReviewPhrases(items = []) {
  return serializePipeRows(
    items.map((item) => [item.speaker ?? "", item.text ?? "", item.translation ?? ""].join(" | "))
  );
}

function parseDialogueLinesText(text) {
  return parsePipeRows(text, 3).map(([id, speaker, lineText]) => ({
    id,
    speaker,
    text: lineText
  })).filter((item) => item.id || item.speaker || item.text);
}

function serializeDialogueLines(lines = []) {
  return serializePipeRows(
    lines.map((line) => [line.id ?? "", line.speaker ?? "", line.text ?? ""].join(" | "))
  );
}

function parseVariantsText(text) {
  const groups = [];
  let current = [];

  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed === "---") {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
      continue;
    }

    const [id, speaker, content] = line.split("|").map((cell) => cell.trim());
    current.push({ id: id ?? "", speaker: speaker ?? "", text: content ?? "" });
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

function serializeVariants(variants = []) {
  return variants
    .map((group) => group.map((line) => [line.id ?? "", line.speaker ?? "", line.text ?? ""].join(" | ")).join("\n"))
    .join("\n---\n");
}

function parseZoneText(text) {
  return parsePipeRows(text, 5).map(([x, y, width, height, color]) => ({
    x: Number(x) || 0,
    y: Number(y) || 0,
    width: Number(width) || 120,
    height: Number(height) || 120,
    color: color || "#dfeef7"
  }));
}

function serializeZones(zones = []) {
  return serializePipeRows(
    zones.map((zone) => [zone.x ?? 0, zone.y ?? 0, zone.width ?? 120, zone.height ?? 120, zone.color ?? "#dfeef7"].join(" | "))
  );
}

function parseOptionsText(text) {
  return parsePipeRows(text, 3).map(([id, label, correct]) => ({
    id,
    label,
    isCorrect: /^(yes|true|1|correct)$/i.test(correct)
  })).filter((item) => item.id || item.label);
}

function serializeOptions(options = []) {
  return serializePipeRows(
    options.map((option) => [option.id ?? "", option.label ?? "", option.isCorrect ? "yes" : "no"].join(" | "))
  );
}

function parseLineListText(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function serializeLineList(items = []) {
  return items.join("\n");
}

function parseTargetIds(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeTargetIds(items = []) {
  return items.join(", ");
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getSpeakerEntries() {
  return Object.entries(state.story?.speakers ?? {});
}

function getVoiceOptions() {
  return state.bootstrap?.voiceLibrary ?? [];
}

function getTemplateMeta() {
  return state.bootstrap?.templates ?? [];
}

function getEnvironmentAssets() {
  return state.bootstrap?.assetLibrary?.environment ?? [];
}

function getAvatarAssets() {
  return state.bootstrap?.assetLibrary?.avatars ?? [];
}

function getUiAssets() {
  return state.bootstrap?.assetLibrary?.ui ?? [];
}

function getStory() {
  return state.story;
}

function getStepIds() {
  return (getStory()?.steps ?? []).map((step) => step.id);
}

function getInteractiveIds() {
  return (getStory()?.interactives ?? []).map((interactive) => interactive.id);
}

function getNextId(prefix, existing) {
  let index = 1;
  let candidate = `${prefix}${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${prefix}${index}`;
  }
  return candidate;
}

function getResponseEntries(interactive) {
  return Object.entries(interactive.responses ?? {});
}

function resolvePreviewSrc(path) {
  if (!path) {
    return "";
  }
  return state.customAssets[path]?.dataUrl ?? path;
}

function buildCustomAssetPath(kind, fileName) {
  return `${DEFAULT_CUSTOM_DIR}/${kind}-${Date.now()}-${sanitizeFileName(fileName)}`;
}

function saveDraft() {
  if (!state.story) {
    return;
  }

  const payload = {
    templateId: state.templateId,
    story: state.story,
    buildSlug: state.buildSlug,
    provider: state.provider,
    generateAudio: state.generateAudio,
    customAssets: state.customAssets
  };

  window.localStorage.setItem(STORAGE_KEY, jsonToText(payload));
}

function loadDraftFromStorage() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return parseJson(raw);
  } catch {
    return null;
  }
}

function clearDraftFromStorage() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function touch(options = {}) {
  saveDraft();
  renderSummaryCards();
  renderPreviewMeta();
  renderAssetLibrary();
  if (options.map !== false) {
    renderMapStage();
    renderMapSelectionEditor();
    renderMapItemList();
  }
  if (options.json !== false && state.activeTab === "json") {
    dom.jsonEditor.value = jsonToText(state.story);
  }
}

function switchTab(tabId) {
  state.activeTab = tabId;
  for (const button of dom.navButtons) {
    button.classList.toggle("is-active", button.dataset.tab === tabId);
  }
  for (const panel of dom.panels) {
    panel.classList.toggle("is-active", panel.dataset.panel === tabId);
  }
  if (tabId === "json") {
    dom.jsonEditor.value = jsonToText(state.story);
  }
  if (tabId === "build") {
    renderBuildPanel();
  }
}

function populateTopControls() {
  dom.templateSelect.innerHTML = getTemplateMeta()
    .map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.label)}</option>`)
    .join("");
  dom.templateSelect.value = state.templateId ?? getTemplateMeta()[0]?.id ?? "";
  dom.providerSelect.value = state.provider;
  dom.buildAudioInput.checked = state.generateAudio;
}

function renderSummaryCards() {
  const story = getStory();
  if (!story) {
    dom.summaryCards.innerHTML = "";
    return;
  }
  const cards = [
    { label: "Speakers", value: Object.keys(story.speakers ?? {}).length },
    { label: "Interactives", value: (story.interactives ?? []).length },
    { label: "Steps", value: (story.steps ?? []).length },
    { label: "Checks", value: (story.comprehensionChecks ?? []).length }
  ];

  dom.summaryCards.innerHTML = cards.map((card) => `
    <article class="summary-card">
      <span class="summary-label">${escapeHtml(card.label)}</span>
      <span class="summary-value">${escapeHtml(card.value)}</span>
    </article>
  `).join("");
}

function renderPreviewMeta() {
  const story = getStory();
  if (!story) {
    dom.previewMeta.innerHTML = "";
    return;
  }

  const previewItems = [
    { label: "Title", value: story.meta?.title ?? "Untitled" },
    { label: "Case", value: story.meta?.caseTitle ?? "No case title" },
    { label: "Folder", value: state.buildSlug || slugify(story.meta?.title || "new-game") || "new-game" },
    { label: "Custom Uploads", value: Object.keys(state.customAssets).length }
  ];

  dom.previewMeta.innerHTML = previewItems.map((item) => `
    <article class="preview-card">
      <span class="builder-kicker">${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join("");
}

function renderAssetLibrary() {
  const sections = [
    { title: "Avatars", items: getAvatarAssets() },
    { title: "Environment", items: getEnvironmentAssets() },
    { title: "Inventory", items: getUiAssets() }
  ];

  dom.assetLibrary.innerHTML = sections.map((section) => `
    <article class="asset-card">
      <div class="asset-card-title">${escapeHtml(section.title)}</div>
      <div class="asset-grid">
        ${section.items.map((item) => `
          <div class="asset-pill">
            <img src="${escapeHtml(item.path)}" alt="">
            <span>${escapeHtml(item.name)}</span>
            <code>${escapeHtml(item.key)}</code>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderGamePanel() {
  const story = getStory();
  if (!story) {
    return;
  }

  dom.gameTitleInput.value = story.meta?.title ?? "";
  dom.caseTitleInput.value = story.meta?.caseTitle ?? "";
  dom.caseTagInput.value = story.meta?.caseTag ?? "";
  dom.playerNameInput.value = story.meta?.playerName ?? "";
  dom.browserAudioSpeedInput.value = String(story.meta?.defaultAudioRate ?? 0.9);
  dom.globalNaturalRateInput.value = "";
  dom.pregameVocabInput.value = serializeVocabulary(story.meta?.preGameVocab ?? []);
  dom.reviewPhrasesInput.value = serializeReviewPhrases(story.meta?.reviewPhrases ?? []);
  dom.introLinesInput.value = serializeDialogueLines(story.introLines ?? []);
}

function renderMapStage() {
  const story = getStory();
  if (!story) {
    dom.mapStage.innerHTML = "";
    return;
  }

  const worldWidth = Number(story.world?.width) || 1000;
  const worldHeight = Number(story.world?.height) || 900;
  dom.mapStage.style.aspectRatio = `${worldWidth} / ${worldHeight}`;

  const zoneHtml = (story.world?.zones ?? []).map((zone, index) => `
    <div class="map-zone"
      style="left:${(zone.x / worldWidth) * 100}%;top:${(zone.y / worldHeight) * 100}%;width:${(zone.width / worldWidth) * 100}%;height:${(zone.height / worldHeight) * 100}%;background:${escapeHtml(zone.color)};"
      title="Zone ${index + 1}">
    </div>
  `).join("");

  const decorHtml = (story.world?.decor ?? []).map((decor, index) => {
    const selected = state.selectedMapTarget.kind === "decor" && state.selectedMapTarget.index === index;
    const src = resolvePreviewSrc(decor.asset);
    return `
      <button class="map-item ${selected ? "is-selected" : ""}" type="button"
        data-map-kind="decor" data-map-index="${index}"
        style="left:${(decor.x / worldWidth) * 100}%;top:${(decor.y / worldHeight) * 100}%;">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(decor.asset ?? "decor")}">
        <span class="map-item-label">${escapeHtml(getAssetName(decor.asset))}</span>
      </button>
    `;
  }).join("");

  const interactiveHtml = (story.interactives ?? []).map((interactive, index) => {
    const selected = state.selectedMapTarget.kind === "interactive" && state.selectedMapTarget.index === index;
    if (interactive.kind === "npc") {
      const speaker = story.speakers?.[interactive.speakerId] ?? {};
      const avatar = resolvePreviewSrc(speaker.avatar);
      const label = speaker.name || interactive.label || interactive.id;
      if (avatar) {
        return `
          <button class="map-item ${selected ? "is-selected" : ""}" type="button"
            data-map-kind="interactive" data-map-index="${index}"
            style="left:${(interactive.x / worldWidth) * 100}%;top:${(interactive.y / worldHeight) * 100}%;">
            <img class="map-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(label)}" style="border-color:${escapeHtml(speaker.tokenColor ?? "#ffffff")}">
            <span class="map-item-label">${escapeHtml(label)}</span>
          </button>
        `;
      }
      return `
        <button class="map-item ${selected ? "is-selected" : ""}" type="button"
          data-map-kind="interactive" data-map-index="${index}"
          style="left:${(interactive.x / worldWidth) * 100}%;top:${(interactive.y / worldHeight) * 100}%;">
          <span class="map-avatar" style="background:${escapeHtml(speaker.tokenColor ?? "#5a8cf1")}">${escapeHtml(label.slice(0, 2).toUpperCase())}</span>
          <span class="map-item-label">${escapeHtml(label)}</span>
        </button>
      `;
    }

    const src = resolvePreviewSrc(interactive.asset);
    return `
      <button class="map-item ${selected ? "is-selected" : ""}" type="button"
        data-map-kind="interactive" data-map-index="${index}"
        style="left:${(interactive.x / worldWidth) * 100}%;top:${(interactive.y / worldHeight) * 100}%;">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(interactive.label ?? interactive.id)}">
        <span class="map-item-label">${escapeHtml(interactive.label ?? interactive.id)}</span>
      </button>
    `;
  }).join("");

  dom.mapStage.innerHTML = `${zoneHtml}${decorHtml}${interactiveHtml}`;
}

function renderMapSelectionEditor() {
  const selection = getSelectedMapEntry();
  const story = getStory();
  if (!story || !selection) {
    dom.mapSelectionEditor.innerHTML = `<div class="builder-empty">Select or add a map item first.</div>`;
    return;
  }

  if (selection.kind === "interactive") {
    const interactive = selection.entry;
    const speakerOptions = getSpeakerEntries().map(([speakerId]) => `
      <option value="${escapeHtml(speakerId)}" ${interactive.speakerId === speakerId ? "selected" : ""}>${escapeHtml(speakerId)}</option>
    `).join("");
    const assetOptions = getEnvironmentAssets().map((asset) => `
      <option value="${escapeHtml(asset.path)}" ${interactive.asset === asset.path ? "selected" : ""}>${escapeHtml(asset.key)}</option>
    `).join("");

    dom.mapSelectionEditor.innerHTML = `
      <div class="entity-grid">
        <label class="builder-field">
          <span>ID</span>
          <input type="text" data-map-field="id" value="${escapeHtml(interactive.id ?? "")}">
        </label>
        <label class="builder-field">
          <span>Label</span>
          <input type="text" data-map-field="label" value="${escapeHtml(interactive.label ?? "")}">
        </label>
        <label class="builder-field">
          <span>Kind</span>
          <select data-map-field="kind">
            <option value="npc" ${interactive.kind === "npc" ? "selected" : ""}>NPC</option>
            <option value="object" ${interactive.kind === "object" ? "selected" : ""}>Object</option>
          </select>
        </label>
        <label class="builder-field">
          <span>X</span>
          <input type="number" data-map-field="x" value="${escapeHtml(interactive.x ?? 0)}">
        </label>
        <label class="builder-field">
          <span>Y</span>
          <input type="number" data-map-field="y" value="${escapeHtml(interactive.y ?? 0)}">
        </label>
        <label class="builder-field">
          <span>Radius</span>
          <input type="number" data-map-field="radius" value="${escapeHtml(interactive.radius ?? 80)}">
        </label>
        <label class="builder-field">
          <span>Scale</span>
          <input type="number" step="0.1" data-map-field="scale" value="${escapeHtml(interactive.scale ?? 1)}">
        </label>
        ${interactive.kind === "npc" ? `
          <label class="builder-field">
            <span>Speaker</span>
            <select data-map-field="speakerId">${speakerOptions}</select>
          </label>
        ` : `
          <label class="builder-field">
            <span>Asset</span>
            <select data-map-field="asset">${assetOptions}</select>
          </label>
          <label class="builder-field">
            <span>Upload Custom Asset</span>
            <input type="file" accept="image/*" data-upload-kind="interactive-asset">
          </label>
        `}
      </div>
      <div class="builder-inline-actions">
        <button class="builder-button builder-button-ghost" type="button" data-action="remove-selected-map-item">Remove This Interactive</button>
      </div>
    `;
    return;
  }

  const decor = selection.entry;
  const assetOptions = getEnvironmentAssets().map((asset) => `
    <option value="${escapeHtml(asset.path)}" ${decor.asset === asset.path ? "selected" : ""}>${escapeHtml(asset.key)}</option>
  `).join("");

  dom.mapSelectionEditor.innerHTML = `
    <div class="entity-grid">
      <label class="builder-field">
        <span>Asset</span>
        <select data-map-field="asset">${assetOptions}</select>
      </label>
      <label class="builder-field">
        <span>X</span>
        <input type="number" data-map-field="x" value="${escapeHtml(decor.x ?? 0)}">
      </label>
      <label class="builder-field">
        <span>Y</span>
        <input type="number" data-map-field="y" value="${escapeHtml(decor.y ?? 0)}">
      </label>
      <label class="builder-field">
        <span>Scale</span>
        <input type="number" step="0.1" data-map-field="scale" value="${escapeHtml(decor.scale ?? 1)}">
      </label>
      <label class="builder-field">
        <span>Collider Width</span>
        <input type="number" data-map-field="colliderWidth" value="${escapeHtml(decor.collider?.width ?? 0)}">
      </label>
      <label class="builder-field">
        <span>Collider Height</span>
        <input type="number" data-map-field="colliderHeight" value="${escapeHtml(decor.collider?.height ?? 0)}">
      </label>
      <label class="builder-field">
        <span>Upload Custom Asset</span>
        <input type="file" accept="image/*" data-upload-kind="decor-asset">
      </label>
    </div>
    <div class="builder-inline-actions">
      <button class="builder-button builder-button-ghost" type="button" data-action="remove-selected-map-item">Remove This Decor</button>
    </div>
  `;
}

function renderMapItemList() {
  const story = getStory();
  if (!story) {
    dom.mapItemList.innerHTML = "";
    return;
  }

  const chips = [
    ...(story.interactives ?? []).map((interactive, index) => ({
      kind: "interactive",
      index,
      label: interactive.kind === "npc"
        ? story.speakers?.[interactive.speakerId]?.name ?? interactive.label ?? interactive.id
        : interactive.label ?? interactive.id,
      meta: interactive.kind
    })),
    ...(story.world?.decor ?? []).map((decor, index) => ({
      kind: "decor",
      index,
      label: getAssetName(decor.asset),
      meta: "decor"
    }))
  ];

  dom.mapItemList.innerHTML = chips.map((chip) => `
    <div class="map-chip">
      <div>
        <strong>${escapeHtml(chip.label)}</strong>
        <div class="builder-help">${escapeHtml(chip.meta)}</div>
      </div>
      <button type="button" data-action="select-map-item" data-map-kind="${escapeHtml(chip.kind)}" data-map-index="${chip.index}">Select</button>
    </div>
  `).join("");
}

function renderPeoplePanel() {
  const speakerCards = getSpeakerEntries().map(([speakerId, speaker]) => {
    const avatarOptions = getAvatarAssets().map((asset) => `
      <option value="${escapeHtml(asset.path)}" ${speaker.avatar === asset.path ? "selected" : ""}>${escapeHtml(asset.key)}</option>
    `).join("");
    const previewSrc = resolvePreviewSrc(speaker.avatar);
    return `
      <article class="entity-card">
        <div class="entity-card-head">
          <div>
            <p class="builder-kicker">Speaker</p>
            <h3 class="entity-title">${escapeHtml(speaker.name ?? speakerId)}</h3>
          </div>
          <button class="builder-button builder-button-ghost" type="button" data-action="remove-speaker" data-speaker-id="${escapeHtml(speakerId)}">Remove</button>
        </div>
        <div class="entity-grid">
          <label class="builder-field">
            <span>ID</span>
            <input type="text" data-speaker-id="${escapeHtml(speakerId)}" data-speaker-field="id" value="${escapeHtml(speakerId)}">
          </label>
          <label class="builder-field">
            <span>Name</span>
            <input type="text" data-speaker-id="${escapeHtml(speakerId)}" data-speaker-field="name" value="${escapeHtml(speaker.name ?? "")}">
          </label>
          <label class="builder-field">
            <span>Role</span>
            <input type="text" data-speaker-id="${escapeHtml(speakerId)}" data-speaker-field="role" value="${escapeHtml(speaker.role ?? "")}">
          </label>
          <label class="builder-field">
            <span>Natural Voice</span>
            <input type="text" list="voice-options" data-speaker-id="${escapeHtml(speakerId)}" data-speaker-field="naturalVoice" value="${escapeHtml(speaker.naturalVoice ?? "")}">
          </label>
          <label class="builder-field">
            <span>Natural Rate</span>
            <input type="text" data-speaker-id="${escapeHtml(speakerId)}" data-speaker-field="naturalRate" value="${escapeHtml(speaker.naturalRate ?? "")}">
          </label>
          <label class="builder-field">
            <span>Fallback Voice</span>
            <input type="text" data-speaker-id="${escapeHtml(speakerId)}" data-speaker-field="voice" value="${escapeHtml(speaker.voice ?? "")}">
          </label>
          <label class="builder-field">
            <span>Token Color</span>
            <input type="color" data-speaker-id="${escapeHtml(speakerId)}" data-speaker-field="tokenColor" value="${escapeHtml(speaker.tokenColor ?? "#5a8cf1")}">
          </label>
          <label class="builder-field">
            <span>Avatar</span>
            <select data-speaker-id="${escapeHtml(speakerId)}" data-speaker-field="avatar">${avatarOptions}</select>
          </label>
          <label class="builder-field">
            <span>Upload Avatar</span>
            <input type="file" accept="image/*" data-upload-kind="speaker-avatar" data-speaker-id="${escapeHtml(speakerId)}">
          </label>
        </div>
        ${previewSrc ? `
          <div class="builder-upload-preview">
            <img src="${escapeHtml(previewSrc)}" alt="${escapeHtml(speaker.name ?? speakerId)}">
            <div class="builder-help">${escapeHtml(speaker.avatar ?? "")}</div>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");

  dom.peopleList.innerHTML = speakerCards || `<div class="builder-empty">Add a character to start.</div>`;
}

function renderInteractivesPanel() {
  const story = getStory();
  if (!story) {
    dom.interactivesList.innerHTML = "";
    return;
  }

  dom.interactivesList.innerHTML = (story.interactives ?? []).map((interactive, interactiveIndex) => `
    <article class="entity-card">
      <div class="entity-card-head">
        <div>
          <p class="builder-kicker">Interactive ${interactiveIndex + 1}</p>
          <h3 class="entity-title">${escapeHtml(interactive.label ?? interactive.id)}</h3>
        </div>
        <button class="builder-button builder-button-secondary" type="button" data-action="add-response" data-interactive-index="${interactiveIndex}">Add Response</button>
      </div>

      <div class="entity-grid">
        <label class="builder-field">
          <span>ID</span>
          <input type="text" data-interactive-index="${interactiveIndex}" data-interactive-field="id" value="${escapeHtml(interactive.id ?? "")}">
        </label>
        <label class="builder-field">
          <span>Label</span>
          <input type="text" data-interactive-index="${interactiveIndex}" data-interactive-field="label" value="${escapeHtml(interactive.label ?? "")}">
        </label>
        <label class="builder-field">
          <span>Kind</span>
          <select data-interactive-index="${interactiveIndex}" data-interactive-field="kind">
            <option value="npc" ${interactive.kind === "npc" ? "selected" : ""}>NPC</option>
            <option value="object" ${interactive.kind === "object" ? "selected" : ""}>Object</option>
          </select>
        </label>
      </div>

      <div class="response-list">
        ${getResponseEntries(interactive).map(([responseKey, response]) => renderResponseCard(interactiveIndex, responseKey, response)).join("")}
      </div>
    </article>
  `).join("");
}

function renderResponseCard(interactiveIndex, responseKey, response) {
  const mode = Array.isArray(response.variants) ? "variants" : "lines";
  const linesText = mode === "variants"
    ? serializeVariants(response.variants ?? [])
    : serializeDialogueLines(response.lines ?? []);

  return `
    <section class="response-card">
      <div class="entity-card-head">
        <h3 class="entity-title">${escapeHtml(responseKey)}</h3>
        <button class="builder-button builder-button-ghost" type="button" data-action="remove-response" data-interactive-index="${interactiveIndex}" data-response-key="${escapeHtml(responseKey)}">Remove</button>
      </div>
      <div class="entity-grid">
        <label class="builder-field">
          <span>Response Key</span>
          <input type="text" data-interactive-index="${interactiveIndex}" data-response-key="${escapeHtml(responseKey)}" data-response-field="key" value="${escapeHtml(responseKey)}">
        </label>
        <label class="builder-field">
          <span>Mode</span>
          <select data-interactive-index="${interactiveIndex}" data-response-key="${escapeHtml(responseKey)}" data-response-field="mode">
            <option value="lines" ${mode === "lines" ? "selected" : ""}>Lines</option>
            <option value="variants" ${mode === "variants" ? "selected" : ""}>Rotate Variants</option>
          </select>
        </label>
        <label class="builder-field">
          <span>Next Step</span>
          <input type="text" data-interactive-index="${interactiveIndex}" data-response-key="${escapeHtml(responseKey)}" data-response-field="step" value="${escapeHtml(response.effects?.step ?? "")}">
        </label>
        <label class="builder-field">
          <span>Add Inventory</span>
          <input type="text" data-interactive-index="${interactiveIndex}" data-response-key="${escapeHtml(responseKey)}" data-response-field="addInventory" value="${escapeHtml(serializeTargetIds(response.effects?.addInventory ?? []))}">
        </label>
      </div>
      <label class="builder-checkbox">
        <input type="checkbox" data-interactive-index="${interactiveIndex}" data-response-key="${escapeHtml(responseKey)}" data-response-field="completeCase" ${response.effects?.completeCase ? "checked" : ""}>
        <span>Marks the case as complete</span>
      </label>
      <label class="builder-field">
        <span>Notes</span>
        <textarea data-interactive-index="${interactiveIndex}" data-response-key="${escapeHtml(responseKey)}" data-response-field="notes">${escapeHtml(serializeLineList(response.effects?.notes ?? []))}</textarea>
      </label>
      <label class="builder-field">
        <span>Dialogue ${mode === "variants" ? "(use --- between variants)" : ""}</span>
        <textarea data-interactive-index="${interactiveIndex}" data-response-key="${escapeHtml(responseKey)}" data-response-field="lines">${escapeHtml(linesText)}</textarea>
      </label>
    </section>
  `;
}

function renderStepsPanel() {
  const story = getStory();
  if (!story) {
    dom.stepsList.innerHTML = "";
    return;
  }

  dom.stepsList.innerHTML = (story.steps ?? []).map((step, stepIndex) => `
    <article class="entity-card">
      <div class="entity-card-head">
        <div>
          <p class="builder-kicker">Step ${stepIndex + 1}</p>
          <h3 class="entity-title">${escapeHtml(step.title ?? step.id)}</h3>
        </div>
        <div class="builder-inline-actions">
          <button class="builder-button builder-button-ghost" type="button" data-action="move-step-up" data-step-index="${stepIndex}">Up</button>
          <button class="builder-button builder-button-ghost" type="button" data-action="move-step-down" data-step-index="${stepIndex}">Down</button>
          <button class="builder-button builder-button-ghost" type="button" data-action="duplicate-step" data-step-index="${stepIndex}">Duplicate</button>
          <button class="builder-button builder-button-ghost" type="button" data-action="remove-step" data-step-index="${stepIndex}">Remove</button>
        </div>
      </div>

      <div class="entity-grid">
        <label class="builder-field">
          <span>ID</span>
          <input type="text" data-step-index="${stepIndex}" data-step-field="id" value="${escapeHtml(step.id ?? "")}">
        </label>
        <label class="builder-field">
          <span>Title</span>
          <input type="text" data-step-index="${stepIndex}" data-step-field="title" value="${escapeHtml(step.title ?? "")}">
        </label>
        <label class="builder-field">
          <span>Target IDs</span>
          <input type="text" data-step-index="${stepIndex}" data-step-field="targetIds" value="${escapeHtml(serializeTargetIds(step.targetIds ?? []))}">
        </label>
      </div>

      <label class="builder-field">
        <span>Instruction</span>
        <textarea data-step-index="${stepIndex}" data-step-field="instruction">${escapeHtml(step.instruction ?? "")}</textarea>
      </label>

      <div class="entity-grid-two">
        <label class="builder-field">
          <span>Vocabulary</span>
          <textarea data-step-index="${stepIndex}" data-step-field="vocabulary">${escapeHtml(serializeVocabulary(step.vocabulary ?? []))}</textarea>
        </label>
        <label class="builder-field">
          <span>Hints</span>
          <textarea data-step-index="${stepIndex}" data-step-field="hints">${escapeHtml(serializeDialogueLines(step.hints ?? []))}</textarea>
        </label>
      </div>

      <div class="entity-grid-two">
        <label class="builder-field">
          <span>Wrong Note</span>
          <textarea data-step-index="${stepIndex}" data-step-field="wrongNote">${escapeHtml(step.wrongInteraction?.note ?? "")}</textarea>
        </label>
        <label class="builder-field">
          <span>Wrong Turn Lines</span>
          <textarea data-step-index="${stepIndex}" data-step-field="wrongLines">${escapeHtml(serializeDialogueLines(step.wrongInteraction?.lines ?? []))}</textarea>
        </label>
      </div>
    </article>
  `).join("");
}

function renderChecksPanel() {
  const story = getStory();
  if (!story) {
    dom.checksList.innerHTML = "";
    return;
  }

  dom.checksList.innerHTML = (story.comprehensionChecks ?? []).map((check, checkIndex) => `
    <article class="entity-card">
      <div class="entity-card-head">
        <div>
          <p class="builder-kicker">Check ${checkIndex + 1}</p>
          <h3 class="entity-title">${escapeHtml(check.question ?? check.id)}</h3>
        </div>
        <button class="builder-button builder-button-ghost" type="button" data-action="remove-check" data-check-index="${checkIndex}">Remove</button>
      </div>
      <div class="entity-grid">
        <label class="builder-field">
          <span>ID</span>
          <input type="text" data-check-index="${checkIndex}" data-check-field="id" value="${escapeHtml(check.id ?? "")}">
        </label>
        <label class="builder-field">
          <span>Step ID</span>
          <input type="text" data-check-index="${checkIndex}" data-check-field="stepId" value="${escapeHtml(check.stepId ?? "")}">
        </label>
        <label class="builder-field">
          <span>Question</span>
          <input type="text" data-check-index="${checkIndex}" data-check-field="question" value="${escapeHtml(check.question ?? "")}">
        </label>
      </div>
      <label class="builder-field">
        <span>Help</span>
        <textarea data-check-index="${checkIndex}" data-check-field="help">${escapeHtml(check.help ?? "")}</textarea>
      </label>
      <div class="entity-grid-two">
        <label class="builder-field">
          <span>Options</span>
          <textarea data-check-index="${checkIndex}" data-check-field="options">${escapeHtml(serializeOptions(check.options ?? []))}</textarea>
        </label>
        <label class="builder-field">
          <span>Correct Lines</span>
          <textarea data-check-index="${checkIndex}" data-check-field="correctLines">${escapeHtml(serializeDialogueLines(check.correctLines ?? []))}</textarea>
        </label>
      </div>
      <div class="entity-grid-two">
        <label class="builder-field">
          <span>Wrong Lines</span>
          <textarea data-check-index="${checkIndex}" data-check-field="wrongLines">${escapeHtml(serializeDialogueLines(check.wrongLines ?? []))}</textarea>
        </label>
        <label class="builder-field">
          <span>Notes</span>
          <textarea data-check-index="${checkIndex}" data-check-field="notes">${escapeHtml(`${check.notes?.correct ?? ""}\n---\n${check.notes?.wrong ?? ""}`)}</textarea>
        </label>
      </div>
    </article>
  `).join("") || `<div class="builder-empty">No checks yet. You can add up to 2.</div>`;
}

function renderBuildPanel() {
  dom.buildSlugInput.value = state.buildSlug || slugify(getStory()?.meta?.title || "new-game") || "new-game";
  dom.providerSelect.value = state.provider;
  dom.buildAudioInput.checked = state.generateAudio;
  renderValidationMessages(state.validationMessages);
  renderBuildResult();
}

function renderValidationMessages(messages) {
  if (!messages || messages.length === 0) {
    dom.validationList.innerHTML = `<div class="validation-item is-good">No validation messages yet. Press Validate before you build.</div>`;
    return;
  }
  dom.validationList.innerHTML = messages.map((message) => `
    <div class="validation-item is-${escapeHtml(message.type)}">${escapeHtml(message.text)}</div>
  `).join("");
}

function renderBuildResult() {
  if (!state.buildResult) {
    dom.buildResult.innerHTML = `<div class="builder-status">No build has run in this session yet.</div>`;
    return;
  }

  if (!state.buildResult.ok) {
    dom.buildResult.innerHTML = `
      <div class="builder-status">Build failed.</div>
      <pre>${escapeHtml(state.buildResult.error ?? "Unknown error")}</pre>
    `;
    return;
  }

  dom.buildResult.innerHTML = `
    <div class="builder-status">Build finished in <code>${escapeHtml(state.buildResult.outputDir)}</code>.</div>
    <div><a href="${escapeHtml(state.buildResult.playUrl)}" target="_blank" rel="noreferrer">Open built game</a></div>
    ${state.buildResult.log ? `<pre>${escapeHtml(state.buildResult.log)}</pre>` : ""}
  `;
}

function renderVoiceOptions() {
  dom.voiceOptions.innerHTML = getVoiceOptions()
    .map((voice) => `<option value="${escapeHtml(voice)}"></option>`)
    .join("");
}

function getAssetName(path) {
  return String(path ?? "")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    ?.replaceAll("-", " ") || "asset";
}

function getSelectedMapEntry() {
  const story = getStory();
  if (!story) {
    return null;
  }
  if (state.selectedMapTarget.kind === "decor") {
    const entry = story.world?.decor?.[state.selectedMapTarget.index];
    return entry ? { kind: "decor", index: state.selectedMapTarget.index, entry } : null;
  }
  const entry = story.interactives?.[state.selectedMapTarget.index];
  return entry ? { kind: "interactive", index: state.selectedMapTarget.index, entry } : null;
}

function ensureMapSelection() {
  const selection = getSelectedMapEntry();
  if (selection) {
    return;
  }

  const story = getStory();
  if ((story?.interactives ?? []).length > 0) {
    state.selectedMapTarget = { kind: "interactive", index: 0 };
    return;
  }
  if ((story?.world?.decor ?? []).length > 0) {
    state.selectedMapTarget = { kind: "decor", index: 0 };
  }
}

function renameSpeakerId(oldId, nextId) {
  const story = getStory();
  const clean = slugify(nextId);
  if (!clean || clean === oldId || story.speakers[clean]) {
    return oldId;
  }

  story.speakers[clean] = story.speakers[oldId];
  delete story.speakers[oldId];

  for (const line of story.introLines ?? []) {
    if (line.speaker === oldId) {
      line.speaker = clean;
    }
  }

  for (const phrase of story.meta?.reviewPhrases ?? []) {
    if (phrase.speaker === oldId) {
      phrase.speaker = clean;
    }
  }

  for (const step of story.steps ?? []) {
    for (const line of step.hints ?? []) {
      if (line.speaker === oldId) {
        line.speaker = clean;
      }
    }
    for (const line of step.wrongInteraction?.lines ?? []) {
      if (line.speaker === oldId) {
        line.speaker = clean;
      }
    }
  }

  for (const check of story.comprehensionChecks ?? []) {
    for (const line of check.correctLines ?? []) {
      if (line.speaker === oldId) {
        line.speaker = clean;
      }
    }
    for (const line of check.wrongLines ?? []) {
      if (line.speaker === oldId) {
        line.speaker = clean;
      }
    }
  }

  for (const interactive of story.interactives ?? []) {
    if (interactive.speakerId === oldId) {
      interactive.speakerId = clean;
    }
    for (const response of Object.values(interactive.responses ?? {})) {
      for (const line of response.lines ?? []) {
        if (line.speaker === oldId) {
          line.speaker = clean;
        }
      }
      for (const variant of response.variants ?? []) {
        for (const line of variant) {
          if (line.speaker === oldId) {
            line.speaker = clean;
          }
        }
      }
    }
  }

  return clean;
}

function renameInteractiveId(oldId, nextId) {
  const story = getStory();
  const clean = slugify(nextId);
  if (!clean || clean === oldId || getInteractiveIds().includes(clean)) {
    return oldId;
  }

  const interactive = story.interactives.find((item) => item.id === oldId);
  if (!interactive) {
    return oldId;
  }
  interactive.id = clean;

  for (const step of story.steps ?? []) {
    step.targetIds = (step.targetIds ?? []).map((id) => (id === oldId ? clean : id));
  }

  return clean;
}

function renameStepId(oldId, nextId) {
  const story = getStory();
  const clean = slugify(nextId);
  if (!clean || clean === oldId || getStepIds().includes(clean)) {
    return oldId;
  }

  const step = story.steps.find((item) => item.id === oldId);
  if (!step) {
    return oldId;
  }
  step.id = clean;

  for (const check of story.comprehensionChecks ?? []) {
    if (check.stepId === oldId) {
      check.stepId = clean;
    }
  }

  for (const interactive of story.interactives ?? []) {
    if (interactive.responses?.[oldId]) {
      interactive.responses[clean] = interactive.responses[oldId];
      delete interactive.responses[oldId];
    }
    for (const response of Object.values(interactive.responses ?? {})) {
      if (response.effects?.step === oldId) {
        response.effects.step = clean;
      }
    }
  }

  return clean;
}

function makeDefaultResponse(key) {
  return {
    lines: [
      {
        id: `${slugify(key)}_1`,
        speaker: "narrator",
        text: "Add a short line here."
      }
    ],
    effects: {}
  };
}

function addSpeaker() {
  const story = getStory();
  const nextId = getNextId("speaker", new Set(Object.keys(story.speakers ?? {})));
  story.speakers[nextId] = {
    name: `Speaker ${Object.keys(story.speakers ?? {}).length + 1}`,
    role: "Helper",
    avatar: getAvatarAssets()[0]?.path ?? "./assets/images/avatars/manager.svg",
    naturalVoice: getVoiceOptions()[0] ?? "en-US-JennyNeural",
    naturalRate: "-10%",
    voice: "Microsoft Zira Desktop",
    tokenColor: "#5a8cf1"
  };
  renderPeoplePanel();
  touch();
}

function addInteractive() {
  const story = getStory();
  const nextId = getNextId("interactive", new Set(getInteractiveIds()));
  story.interactives.push({
    id: nextId,
    label: `Object ${story.interactives.length + 1}`,
    kind: "object",
    asset: getEnvironmentAssets()[0]?.path ?? "./assets/images/environment/desk.svg",
    x: 180,
    y: 180,
    radius: 84,
    scale: 1,
    responses: {
      default: makeDefaultResponse("default")
    }
  });
  state.selectedMapTarget = { kind: "interactive", index: story.interactives.length - 1 };
  renderInteractivesPanel();
  touch();
}

function addDecor() {
  const story = getStory();
  story.world.decor.push({
    asset: getEnvironmentAssets()[0]?.path ?? "./assets/images/environment/desk.svg",
    x: 200,
    y: 220,
    scale: 1,
    collider: {
      width: 90,
      height: 70
    }
  });
  state.selectedMapTarget = { kind: "decor", index: story.world.decor.length - 1 };
  touch();
}

function addStep() {
  const story = getStory();
  const nextId = getNextId("step", new Set(getStepIds()));
  story.steps.push({
    id: nextId,
    title: `New Step ${story.steps.length + 1}`,
    instruction: "Write the player task here.",
    targetIds: [],
    vocabulary: [],
    hints: [
      {
        id: `${nextId}_hint_1`,
        speaker: "narrator",
        text: "Write a short hint."
      }
    ],
    wrongInteraction: {
      note: "",
      lines: [
        {
          id: `${nextId}_wrong_1`,
          speaker: "narrator",
          text: "Not here."
        }
      ]
    }
  });
  renderStepsPanel();
  renderChecksPanel();
  renderInteractivesPanel();
  touch({ map: false });
}

function duplicateStep(index) {
  const story = getStory();
  const step = story.steps[index];
  if (!step) {
    return;
  }
  const copy = deepClone(step);
  copy.id = getNextId(`${slugify(step.id || "step")}-copy`, new Set(getStepIds()));
  copy.title = `${step.title ?? step.id} Copy`;
  story.steps.splice(index + 1, 0, copy);
  renderStepsPanel();
  touch({ map: false });
}

function moveStep(index, delta) {
  const story = getStory();
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= story.steps.length) {
    return;
  }
  const [step] = story.steps.splice(index, 1);
  story.steps.splice(nextIndex, 0, step);
  renderStepsPanel();
  touch({ map: false });
}

function removeStep(index) {
  const story = getStory();
  const [removed] = story.steps.splice(index, 1);
  if (!removed) {
    return;
  }

  story.comprehensionChecks = (story.comprehensionChecks ?? []).filter((check) => check.stepId !== removed.id);
  for (const interactive of story.interactives ?? []) {
    delete interactive.responses?.[removed.id];
    for (const response of Object.values(interactive.responses ?? {})) {
      if (response.effects?.step === removed.id) {
        delete response.effects.step;
      }
    }
  }
  renderStepsPanel();
  renderChecksPanel();
  renderInteractivesPanel();
  touch({ map: false });
}

function addCheck() {
  const story = getStory();
  story.comprehensionChecks = story.comprehensionChecks ?? [];
  if (story.comprehensionChecks.length >= 2) {
    state.validationMessages = [{ type: "bad", text: "V1 allows only 2 checks per game." }];
    renderValidationMessages(state.validationMessages);
    switchTab("checks");
    return;
  }
  const nextId = getNextId("check", new Set((story.comprehensionChecks ?? []).map((check) => check.id)));
  story.comprehensionChecks.push({
    id: nextId,
    stepId: story.steps?.[0]?.id ?? "",
    question: "Write the check question.",
    help: "Add a short clue reminder.",
    options: [
      { id: "option-a", label: "Option A", isCorrect: true },
      { id: "option-b", label: "Option B", isCorrect: false }
    ],
    correctLines: [{ id: `${nextId}_right_1`, speaker: "narrator", text: "Correct." }],
    wrongLines: [{ id: `${nextId}_wrong_1`, speaker: "narrator", text: "Try again next time." }],
    notes: { correct: "", wrong: "" }
  });
  renderChecksPanel();
  touch({ map: false });
}

function addResponse(interactiveIndex) {
  const story = getStory();
  const interactive = story.interactives[interactiveIndex];
  if (!interactive) {
    return;
  }
  const existingKeys = new Set(Object.keys(interactive.responses ?? {}));
  let key = "default";
  if (existingKeys.has("default")) {
    key = getStepIds().find((stepId) => !existingKeys.has(stepId))
      ?? getNextId("response", existingKeys);
  }
  interactive.responses[key] = makeDefaultResponse(key);
  renderInteractivesPanel();
  touch({ map: false });
}

function removeSelectedMapItem() {
  const selection = getSelectedMapEntry();
  const story = getStory();
  if (!selection || !story) {
    return;
  }

  if (selection.kind === "interactive") {
    const [removed] = story.interactives.splice(selection.index, 1);
    if (removed) {
      for (const step of story.steps ?? []) {
        step.targetIds = (step.targetIds ?? []).filter((id) => id !== removed.id);
      }
    }
  } else {
    story.world.decor.splice(selection.index, 1);
  }

  ensureMapSelection();
  renderInteractivesPanel();
  touch();
}

function setInteractiveField(index, field, value) {
  const interactive = getStory()?.interactives?.[index];
  if (!interactive) {
    return;
  }

  if (field === "id") {
    const nextId = renameInteractiveId(interactive.id, value);
    renderStepsPanel();
    renderInteractivesPanel();
    touch({ map: false });
    return nextId;
  }

  if (field === "x" || field === "y" || field === "radius" || field === "scale") {
    interactive[field] = Number(value) || 0;
    touch();
    return;
  }

  interactive[field] = value;
  renderMapSelectionEditor();
  touch();
}

function setSpeakerField(speakerId, field, value) {
  const story = getStory();
  const speaker = story?.speakers?.[speakerId];
  if (!speaker) {
    return;
  }

  if (field === "id") {
    const nextId = renameSpeakerId(speakerId, value);
    renderPeoplePanel();
    renderInteractivesPanel();
    touch({ map: true });
    return nextId;
  }

  speaker[field] = value;
  touch({ map: true });
}

function setStepField(index, field, value) {
  const step = getStory()?.steps?.[index];
  if (!step) {
    return;
  }

  if (field === "id") {
    renameStepId(step.id, value);
    renderStepsPanel();
    renderChecksPanel();
    renderInteractivesPanel();
    touch({ map: false });
    return;
  }

  if (field === "title" || field === "instruction") {
    step[field] = value;
  } else if (field === "targetIds") {
    step.targetIds = parseTargetIds(value);
  } else if (field === "vocabulary") {
    step.vocabulary = parseVocabularyText(value);
  } else if (field === "hints") {
    step.hints = parseDialogueLinesText(value);
  } else if (field === "wrongNote") {
    step.wrongInteraction = step.wrongInteraction ?? { note: "", lines: [] };
    step.wrongInteraction.note = value;
  } else if (field === "wrongLines") {
    step.wrongInteraction = step.wrongInteraction ?? { note: "", lines: [] };
    step.wrongInteraction.lines = parseDialogueLinesText(value);
  }
  touch({ map: false });
}

function setCheckField(index, field, value) {
  const check = getStory()?.comprehensionChecks?.[index];
  if (!check) {
    return;
  }

  if (field === "id" || field === "stepId" || field === "question" || field === "help") {
    check[field] = value;
  } else if (field === "options") {
    check.options = parseOptionsText(value);
  } else if (field === "correctLines") {
    check.correctLines = parseDialogueLinesText(value);
  } else if (field === "wrongLines") {
    check.wrongLines = parseDialogueLinesText(value);
  } else if (field === "notes") {
    const [correct = "", wrong = ""] = String(value ?? "").split(/\n---\n/);
    check.notes = { correct: correct.trim(), wrong: wrong.trim() };
  }
  touch({ map: false });
}

function setResponseField(interactiveIndex, responseKey, field, value) {
  const interactive = getStory()?.interactives?.[interactiveIndex];
  const response = interactive?.responses?.[responseKey];
  if (!interactive || !response) {
    return;
  }
  response.effects = response.effects ?? {};

  if (field === "key") {
    const nextKey = value.trim();
    if (!nextKey || nextKey === responseKey || interactive.responses[nextKey]) {
      return;
    }
    interactive.responses[nextKey] = interactive.responses[responseKey];
    delete interactive.responses[responseKey];
    renderInteractivesPanel();
    touch({ map: false });
    return;
  }

  if (field === "mode") {
    if (value === "variants" && !Array.isArray(response.variants)) {
      response.variants = [response.lines ?? []];
      delete response.lines;
    } else if (value === "lines" && !Array.isArray(response.lines)) {
      response.lines = Array.isArray(response.variants) ? (response.variants[0] ?? []) : [];
      delete response.variants;
    }
    renderInteractivesPanel();
    touch({ map: false });
    return;
  }

  if (field === "step") {
    if (value.trim()) {
      response.effects.step = value.trim();
    } else {
      delete response.effects.step;
    }
  } else if (field === "addInventory") {
    const items = parseTargetIds(value);
    if (items.length > 0) {
      response.effects.addInventory = items;
    } else {
      delete response.effects.addInventory;
    }
  } else if (field === "completeCase") {
    response.effects.completeCase = Boolean(value);
  } else if (field === "notes") {
    const notes = parseLineListText(value);
    if (notes.length > 0) {
      response.effects.notes = notes;
    } else {
      delete response.effects.notes;
    }
  } else if (field === "lines") {
    if (Array.isArray(response.variants)) {
      response.variants = parseVariantsText(value);
    } else {
      response.lines = parseDialogueLinesText(value);
    }
  }

  touch({ map: false });
}

function setMapSelectionField(field, value) {
  const selection = getSelectedMapEntry();
  if (!selection) {
    return;
  }

  if (selection.kind === "interactive") {
    const interactive = selection.entry;
    if (field === "id") {
      const nextId = renameInteractiveId(interactive.id, value);
      renderInteractivesPanel();
      renderStepsPanel();
      touch();
      return nextId;
    }
    if (["x", "y", "radius", "scale"].includes(field)) {
      interactive[field] = Number(value) || 0;
    } else if (field === "kind") {
      interactive.kind = value;
      if (value === "npc") {
        interactive.speakerId = interactive.speakerId || getSpeakerEntries()[0]?.[0] || "narrator";
        delete interactive.asset;
      } else {
        interactive.asset = interactive.asset || getEnvironmentAssets()[0]?.path || "";
        delete interactive.speakerId;
      }
    } else {
      interactive[field] = value;
    }
    renderInteractivesPanel();
    touch();
    return;
  }

  const decor = selection.entry;
  if (["x", "y", "scale", "colliderWidth", "colliderHeight"].includes(field)) {
    const numericValue = Number(value) || 0;
    if (field === "colliderWidth" || field === "colliderHeight") {
      decor.collider = decor.collider ?? { width: 0, height: 0 };
      if (field === "colliderWidth") {
        decor.collider.width = numericValue;
      } else {
        decor.collider.height = numericValue;
      }
    } else {
      decor[field] = numericValue;
    }
  } else {
    decor[field] = value;
  }
  touch();
}

function validateStory(story) {
  const messages = [];
  const speakerIds = new Set(Object.keys(story.speakers ?? {}));
  const stepIds = new Set((story.steps ?? []).map((step) => step.id).filter(Boolean));
  const interactiveIds = new Set((story.interactives ?? []).map((interactive) => interactive.id).filter(Boolean));

  if (!story.meta?.title) {
    messages.push({ type: "bad", text: "Game title is missing." });
  }

  if ((story.steps ?? []).length === 0) {
    messages.push({ type: "bad", text: "Add at least one step." });
  }

  if ((story.comprehensionChecks ?? []).length > 2) {
    messages.push({ type: "bad", text: "There can be at most 2 checks in V1." });
  }

  for (const step of story.steps ?? []) {
    if (!step.id) {
      messages.push({ type: "bad", text: "A step is missing its id." });
    }
    if ((step.targetIds ?? []).some((targetId) => !interactiveIds.has(targetId))) {
      messages.push({ type: "bad", text: `Step "${step.title || step.id}" has a target id that does not exist.` });
    }
    if ((step.hints ?? []).length === 0) {
      messages.push({ type: "warn", text: `Step "${step.title || step.id}" has no hints.` });
    }
    if ((step.wrongInteraction?.lines ?? []).length === 0) {
      messages.push({ type: "warn", text: `Step "${step.title || step.id}" has no wrong-turn coaching line.` });
    }
  }

  for (const interactive of story.interactives ?? []) {
    if (!interactive.id) {
      messages.push({ type: "bad", text: "An interactive is missing its id." });
    }
    if (interactive.kind === "npc" && !speakerIds.has(interactive.speakerId)) {
      messages.push({ type: "bad", text: `NPC "${interactive.label || interactive.id}" points to a missing speaker.` });
    }

    for (const [responseKey, response] of Object.entries(interactive.responses ?? {})) {
      if (responseKey !== "default" && !stepIds.has(responseKey) && !responseKey.startsWith("response")) {
        messages.push({ type: "warn", text: `Response key "${responseKey}" on "${interactive.label || interactive.id}" is not a real step id.` });
      }
      if (response.effects?.step && !stepIds.has(response.effects.step)) {
        messages.push({ type: "bad", text: `Response on "${interactive.label || interactive.id}" points to missing next step "${response.effects.step}".` });
      }
    }
  }

  for (const line of story.introLines ?? []) {
    if (!speakerIds.has(line.speaker)) {
      messages.push({ type: "bad", text: `Intro line "${line.id}" uses missing speaker "${line.speaker}".` });
    }
    if (!line.id || !line.text) {
      messages.push({ type: "bad", text: "Every intro line needs an id and text." });
    }
  }

  for (const check of story.comprehensionChecks ?? []) {
    if (!stepIds.has(check.stepId)) {
      messages.push({ type: "bad", text: `Check "${check.id}" points to missing step "${check.stepId}".` });
    }
    if (!(check.options ?? []).some((option) => option.isCorrect)) {
      messages.push({ type: "bad", text: `Check "${check.id}" needs at least one correct answer.` });
    }
  }

  if ((story.meta?.reviewPhrases ?? []).length === 0) {
    messages.push({ type: "warn", text: "Review phrases are empty." });
  }

  if (messages.length === 0) {
    messages.push({ type: "good", text: "The story shape looks valid for V1." });
  }

  return messages;
}

async function loadTemplate(templateId) {
  const response = await fetch(`./api/builder/template?id=${encodeURIComponent(templateId)}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const payload = await response.json();
  state.templateId = payload.id;
  state.story = payload.story;
  state.buildSlug = slugify(payload.story.meta?.title || payload.id || "new-game");
  state.customAssets = {};
  state.buildResult = null;
  state.validationMessages = [];
  ensureMapSelection();
  renderAll();
  saveDraft();
}

function restoreDraft(draft) {
  state.templateId = draft.templateId ?? getTemplateMeta()[0]?.id ?? null;
  state.story = draft.story;
  state.buildSlug = draft.buildSlug ?? slugify(draft.story?.meta?.title || "new-game");
  state.provider = draft.provider ?? "auto";
  state.generateAudio = draft.generateAudio ?? true;
  state.customAssets = draft.customAssets ?? {};
  state.buildResult = null;
  state.validationMessages = [];
  ensureMapSelection();
  renderAll();
}

function renderAll() {
  populateTopControls();
  renderVoiceOptions();
  renderSummaryCards();
  renderPreviewMeta();
  renderAssetLibrary();
  renderGamePanel();
  dom.worldWidthInput.value = String(getStory()?.world?.width ?? 1000);
  dom.worldHeightInput.value = String(getStory()?.world?.height ?? 900);
  dom.zonesInput.value = serializeZones(getStory()?.world?.zones ?? []);
  renderMapStage();
  renderMapSelectionEditor();
  renderMapItemList();
  renderPeoplePanel();
  renderInteractivesPanel();
  renderStepsPanel();
  renderChecksPanel();
  dom.jsonEditor.value = jsonToText(state.story);
  renderBuildPanel();
  switchTab(state.activeTab);
}

async function handleUpload(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  const dataUrl = await readAsDataUrl(file);

  if (input.dataset.uploadKind === "speaker-avatar") {
    const speakerId = input.dataset.speakerId;
    const path = buildCustomAssetPath("avatar", file.name);
    state.customAssets[path] = { name: file.name, dataUrl };
    setSpeakerField(speakerId, "avatar", path);
    renderPeoplePanel();
    touch();
    return;
  }

  if (input.dataset.uploadKind === "interactive-asset") {
    const selection = getSelectedMapEntry();
    if (!selection || selection.kind !== "interactive") {
      return;
    }
    const path = buildCustomAssetPath("object", file.name);
    state.customAssets[path] = { name: file.name, dataUrl };
    selection.entry.asset = path;
    renderInteractivesPanel();
    touch();
    return;
  }

  if (input.dataset.uploadKind === "decor-asset") {
    const selection = getSelectedMapEntry();
    if (!selection || selection.kind !== "decor") {
      return;
    }
    const path = buildCustomAssetPath("decor", file.name);
    state.customAssets[path] = { name: file.name, dataUrl };
    selection.entry.asset = path;
    touch();
  }
}

async function buildGame() {
  const story = getStory();
  state.validationMessages = validateStory(story);
  renderValidationMessages(state.validationMessages);

  const hasErrors = state.validationMessages.some((message) => message.type === "bad");
  if (hasErrors) {
    state.buildResult = {
      ok: false,
      error: "Fix the validation errors first."
    };
    renderBuildResult();
    return;
  }

  const payload = {
    slug: state.buildSlug || slugify(story.meta?.title || "new-game") || "new-game",
    story,
    provider: state.provider,
    generateAudio: state.generateAudio,
    uploadedAssets: Object.entries(state.customAssets).map(([path, file]) => ({
      path,
      name: file.name,
      dataUrl: file.dataUrl
    }))
  };

  state.buildResult = {
    ok: true,
    outputDir: "Building...",
    log: "Please wait. Audio generation can take a little time."
  };
  renderBuildResult();

  try {
    const response = await fetch("./api/builder/build", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: jsonToText(payload)
    });
    const result = await response.json();
    state.buildResult = result;
    if (result.ok) {
      state.buildSlug = payload.slug;
      saveDraft();
    }
  } catch (error) {
    state.buildResult = {
      ok: false,
      error: error instanceof Error ? error.message : "Build request failed."
    };
  }

  renderBuildResult();
}

function downloadJson() {
  const blob = new Blob([jsonToText(state.story)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.buildSlug || "story"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function applyJsonFromEditor() {
  try {
    const nextStory = parseJson(dom.jsonEditor.value);
    state.story = nextStory;
    ensureMapSelection();
    state.validationMessages = [];
    state.buildResult = null;
    renderAll();
    saveDraft();
  } catch (error) {
    state.validationMessages = [{ type: "bad", text: error instanceof Error ? error.message : "Could not parse JSON." }];
    renderValidationMessages(state.validationMessages);
  }
}

function applyGlobalRateToAll() {
  const rate = dom.globalNaturalRateInput.value.trim() || "-10%";
  for (const speaker of Object.values(getStory()?.speakers ?? {})) {
    speaker.naturalRate = rate;
  }
  renderPeoplePanel();
  touch({ map: false });
}

function syncBuildInputs() {
  state.buildSlug = slugify(dom.buildSlugInput.value) || "new-game";
  state.provider = dom.providerSelect.value;
  state.generateAudio = dom.buildAudioInput.checked;
  saveDraft();
}

function bindStaticInputs() {
  dom.gameTitleInput.addEventListener("input", () => {
    getStory().meta.title = dom.gameTitleInput.value;
    if (!state.buildSlug) {
      state.buildSlug = slugify(dom.gameTitleInput.value);
    }
    touch({ map: false });
  });

  dom.caseTitleInput.addEventListener("input", () => {
    getStory().meta.caseTitle = dom.caseTitleInput.value;
    touch({ map: false });
  });

  dom.caseTagInput.addEventListener("input", () => {
    getStory().meta.caseTag = dom.caseTagInput.value;
    touch({ map: false });
  });

  dom.playerNameInput.addEventListener("input", () => {
    getStory().meta.playerName = dom.playerNameInput.value;
    touch({ map: false });
  });

  dom.browserAudioSpeedInput.addEventListener("input", () => {
    getStory().meta.defaultAudioRate = Number(dom.browserAudioSpeedInput.value) || 0.9;
    touch({ map: false });
  });

  dom.pregameVocabInput.addEventListener("change", () => {
    getStory().meta.preGameVocab = parseVocabularyText(dom.pregameVocabInput.value);
    touch({ map: false });
  });

  dom.reviewPhrasesInput.addEventListener("change", () => {
    getStory().meta.reviewPhrases = parseReviewPhrasesText(dom.reviewPhrasesInput.value);
    touch({ map: false });
  });

  dom.introLinesInput.addEventListener("change", () => {
    getStory().introLines = parseDialogueLinesText(dom.introLinesInput.value);
    touch({ map: false });
  });

  dom.worldWidthInput.addEventListener("input", () => {
    getStory().world.width = Number(dom.worldWidthInput.value) || 1000;
    touch();
  });

  dom.worldHeightInput.addEventListener("input", () => {
    getStory().world.height = Number(dom.worldHeightInput.value) || 900;
    touch();
  });

  dom.zonesInput.addEventListener("change", () => {
    getStory().world.zones = parseZoneText(dom.zonesInput.value);
    touch();
  });

  dom.buildSlugInput.addEventListener("input", syncBuildInputs);
  dom.providerSelect.addEventListener("change", syncBuildInputs);
  dom.buildAudioInput.addEventListener("change", syncBuildInputs);

  dom.templateSelect.addEventListener("change", () => {
    state.templateId = dom.templateSelect.value;
  });
}

function beginMapDrag(event) {
  const target = event.target.closest(".map-item");
  if (!target) {
    return;
  }

  const kind = target.dataset.mapKind;
  const index = Number(target.dataset.mapIndex);
  state.selectedMapTarget = { kind: kind === "decor" ? "decor" : "interactive", index };
  state.drag = {
    kind: state.selectedMapTarget.kind,
    index,
    pointerId: event.pointerId,
    element: target
  };
  target.setPointerCapture(event.pointerId);
  renderMapSelectionEditor();
  renderMapItemList();
}

function updateMapDrag(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) {
    return;
  }
  const story = getStory();
  const rect = dom.mapStage.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * story.world.width);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * story.world.height);
  const clampedX = Math.max(0, Math.min(story.world.width, x));
  const clampedY = Math.max(0, Math.min(story.world.height, y));
  const selection = getSelectedMapEntry();
  if (!selection) {
    return;
  }
  selection.entry.x = clampedX;
  selection.entry.y = clampedY;
  if (state.drag.element) {
    state.drag.element.style.left = `${(clampedX / story.world.width) * 100}%`;
    state.drag.element.style.top = `${(clampedY / story.world.height) * 100}%`;
  }
}

function endMapDrag(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) {
    return;
  }
  state.drag = null;
  renderMapStage();
  renderMapSelectionEditor();
  touch();
}

function bindMapDragging() {
  dom.mapStage.addEventListener("pointerdown", beginMapDrag);
  dom.mapStage.addEventListener("pointermove", updateMapDrag);
  dom.mapStage.addEventListener("pointerup", endMapDrag);
  dom.mapStage.addEventListener("pointercancel", endMapDrag);
}

function bindDelegatedEvents() {
  document.addEventListener("click", async (event) => {
    const tabButton = event.target.closest("[data-tab]");
    if (tabButton && tabButton.classList.contains("builder-nav-button")) {
      switchTab(tabButton.dataset.tab);
      return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) {
      return;
    }

    const name = action.dataset.action;

    if (name === "load-template") {
      await loadTemplate(state.templateId || dom.templateSelect.value);
      return;
    }
    if (name === "restore-draft") {
      const draft = loadDraftFromStorage();
      if (draft?.story) {
        restoreDraft(draft);
      }
      return;
    }
    if (name === "clear-draft") {
      clearDraftFromStorage();
      await loadTemplate(state.templateId || dom.templateSelect.value);
      return;
    }
    if (name === "apply-global-rate") {
      applyGlobalRateToAll();
      return;
    }
    if (name === "add-speaker") {
      addSpeaker();
      return;
    }
    if (name === "add-interactive") {
      addInteractive();
      return;
    }
    if (name === "add-decor") {
      addDecor();
      return;
    }
    if (name === "select-map-item") {
      state.selectedMapTarget = {
        kind: action.dataset.mapKind === "decor" ? "decor" : "interactive",
        index: Number(action.dataset.mapIndex)
      };
      renderMapStage();
      renderMapSelectionEditor();
      renderMapItemList();
      return;
    }
    if (name === "remove-selected-map-item") {
      removeSelectedMapItem();
      return;
    }
    if (name === "remove-speaker") {
      delete getStory().speakers[action.dataset.speakerId];
      renderPeoplePanel();
      touch({ map: false });
      return;
    }
    if (name === "add-response") {
      addResponse(Number(action.dataset.interactiveIndex));
      return;
    }
    if (name === "remove-response") {
      const interactive = getStory().interactives[Number(action.dataset.interactiveIndex)];
      delete interactive.responses[action.dataset.responseKey];
      renderInteractivesPanel();
      touch({ map: false });
      return;
    }
    if (name === "add-step") {
      addStep();
      return;
    }
    if (name === "move-step-up") {
      moveStep(Number(action.dataset.stepIndex), -1);
      return;
    }
    if (name === "move-step-down") {
      moveStep(Number(action.dataset.stepIndex), 1);
      return;
    }
    if (name === "duplicate-step") {
      duplicateStep(Number(action.dataset.stepIndex));
      return;
    }
    if (name === "remove-step") {
      removeStep(Number(action.dataset.stepIndex));
      return;
    }
    if (name === "add-check") {
      addCheck();
      return;
    }
    if (name === "remove-check") {
      getStory().comprehensionChecks.splice(Number(action.dataset.checkIndex), 1);
      renderChecksPanel();
      touch({ map: false });
      return;
    }
    if (name === "refresh-json") {
      dom.jsonEditor.value = jsonToText(state.story);
      return;
    }
    if (name === "apply-json") {
      applyJsonFromEditor();
      return;
    }
    if (name === "download-json") {
      downloadJson();
      return;
    }
    if (name === "validate-story") {
      state.validationMessages = validateStory(getStory());
      renderValidationMessages(state.validationMessages);
      return;
    }
    if (name === "build-game") {
      await buildGame();
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-speaker-field]")) {
      setSpeakerField(target.dataset.speakerId, target.dataset.speakerField, target.value);
      return;
    }
    if (target.matches("[data-interactive-field]")) {
      setInteractiveField(Number(target.dataset.interactiveIndex), target.dataset.interactiveField, target.value);
      return;
    }
    if (target.matches("[data-step-field]")) {
      setStepField(Number(target.dataset.stepIndex), target.dataset.stepField, target.value);
      return;
    }
    if (target.matches("[data-check-field]")) {
      setCheckField(Number(target.dataset.checkIndex), target.dataset.checkField, target.value);
      return;
    }
    if (target.matches("[data-response-field]")) {
      const value = target.type === "checkbox" ? target.checked : target.value;
      setResponseField(Number(target.dataset.interactiveIndex), target.dataset.responseKey, target.dataset.responseField, value);
      return;
    }
    if (target.matches("[data-map-field]")) {
      setMapSelectionField(target.dataset.mapField, target.value);
    }
  });

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.matches("[data-upload-kind]")) {
      await handleUpload(event);
    }
  });
}

async function bootstrap() {
  const response = await fetch("./api/builder/bootstrap");
  if (!response.ok) {
    throw new Error(await response.text());
  }
  state.bootstrap = await response.json();
  state.templateId = getTemplateMeta()[0]?.id ?? null;
  populateTopControls();
  renderVoiceOptions();

  const draft = loadDraftFromStorage();
  if (draft?.story) {
    restoreDraft(draft);
  } else if (state.templateId) {
    await loadTemplate(state.templateId);
  }

  bindStaticInputs();
  bindDelegatedEvents();
  bindMapDragging();
}

bootstrap().catch((error) => {
  dom.buildResult.innerHTML = `<pre>${escapeHtml(error instanceof Error ? error.message : "Builder failed to load.")}</pre>`;
});
