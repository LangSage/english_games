export class UIController {
  constructor(story) {
    this.story = story;
    this.activeDrawerId = null;
    this.handlers = null;
    this.subtitleTimeoutId = null;
    this.elements = {
      startScreen: document.getElementById("start-screen"),
      endScreen: document.getElementById("end-screen"),
      canvasShell: document.querySelector(".canvas-shell"),
      endTitle: document.getElementById("end-title"),
      endSummary: document.getElementById("end-summary"),
      starRow: document.getElementById("star-row"),
      reviewStats: document.getElementById("review-stats"),
      reviewWords: document.getElementById("review-words"),
      reviewPhrases: document.getElementById("review-phrases"),
      startVocabList: document.getElementById("start-vocab-list"),
      subtitlePanel: document.getElementById("subtitle-panel"),
      subtitleSpeaker: document.getElementById("subtitle-speaker"),
      subtitleText: document.getElementById("subtitle-text"),
      messagePanel: document.getElementById("message-panel"),
      messageKicker: document.getElementById("message-kicker"),
      messageTitle: document.getElementById("message-title"),
      messageText: document.getElementById("message-text"),
      messageClose: document.getElementById("message-close"),
      questionPanel: document.getElementById("question-panel"),
      questionText: document.getElementById("question-text"),
      questionHelp: document.getElementById("question-help"),
      questionOptions: document.getElementById("question-options"),
      infoButton: document.getElementById("info-button"),
      speakerAvatar: document.getElementById("speaker-avatar"),
      speakerName: document.getElementById("speaker-name"),
      speakerRole: document.getElementById("speaker-role"),
      dialogueText: document.getElementById("dialogue-text"),
      vocabularyList: document.getElementById("vocabulary-list"),
      inventoryList: document.getElementById("inventory-list"),
      notesList: document.getElementById("notes-list"),
      progressList: document.getElementById("progress-list"),
      startButton: document.getElementById("start-button"),
      resetButton: document.getElementById("reset-button"),
      playAgainButton: document.getElementById("play-again-button"),
      hintButton: document.getElementById("hint-button"),
      audioButton: document.getElementById("audio-button"),
      replayButton: document.getElementById("replay-button"),
      difficultyOptions: document.getElementById("difficulty-options"),
      audioEnabledInput: document.getElementById("audio-enabled-input"),
      audioRateInput: document.getElementById("audio-rate-input"),
      audioRateValue: document.getElementById("audio-rate-value"),
      drawerSheet: document.getElementById("drawer-sheet"),
      drawerTitle: document.getElementById("drawer-title"),
      drawerClose: document.getElementById("drawer-close")
    };
    this.drawerButtons = Array.from(document.querySelectorAll("[data-drawer-button]"));
    this.drawerPanels = Array.from(document.querySelectorAll("[data-drawer-panel]"));
  }

  bindHandlers(handlers) {
    this.handlers = handlers;
    this.elements.startButton.addEventListener("click", handlers.onStart);
    this.elements.resetButton.addEventListener("click", handlers.onReset);
    this.elements.playAgainButton.addEventListener("click", handlers.onStart);
    this.elements.infoButton.addEventListener("click", handlers.onInfo);
    this.elements.hintButton.addEventListener("click", handlers.onHint);
    this.elements.audioButton.addEventListener("click", handlers.onAudioToggle);
    this.elements.replayButton.addEventListener("click", handlers.onReplay);
    this.elements.drawerClose.addEventListener("click", () => this.closeDrawer());
    this.elements.messageClose.addEventListener("click", () => this.hideMessage());
    this.elements.difficultyOptions.addEventListener("click", (event) => {
      const button = event.target.closest("[data-difficulty-id]");
      if (!button) {
        return;
      }
      handlers.onDifficultyChange(button.dataset.difficultyId);
    });
    this.elements.audioEnabledInput.addEventListener("change", (event) => {
      handlers.onAudioEnabledChange(event.target.checked);
    });
    this.elements.audioRateInput.addEventListener("input", (event) => {
      handlers.onAudioRateChange(Number(event.target.value));
    });

    for (const button of this.drawerButtons) {
      button.addEventListener("click", () => {
        this.toggleDrawer(button.dataset.drawerButton);
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.hideMessage();
        this.closeDrawer();
      }
    });
  }

  getStartVocabulary() {
    return this.story.meta.preGameVocab ?? [];
  }

  getDifficultyMode(settings) {
    return this.story.meta.difficultyModes?.find((mode) => mode.id === settings.difficulty)
      ?? this.story.meta.difficultyModes?.[0]
      ?? { translationVisibility: "full" };
  }

  shouldShowTranslation(settings, context) {
    const visibility = this.getDifficultyMode(settings).translationVisibility ?? "full";

    if (visibility === "full") {
      return true;
    }

    if (visibility === "lesson") {
      return context !== "start";
    }

    if (visibility === "review") {
      return context === "review";
    }

    return false;
  }

  renderStartVocabulary(settings) {
    this.elements.startVocabList.innerHTML = "";
    const showTranslation = this.shouldShowTranslation(settings, "start");

    for (const item of this.getStartVocabulary()) {
      const entry = document.createElement("li");
      entry.innerHTML = `
        <span class="start-vocab-term">${item.term}</span>
        <span class="start-vocab-definition">${item.definition}</span>
        ${showTranslation && item.translation ? `<span class="start-vocab-translation">${item.translation}</span>` : ""}
      `;
      this.elements.startVocabList.appendChild(entry);
    }
  }

  setDialogueLine(line, speakers) {
    if (!line) {
      return;
    }

    this.clearSubtitleTimeout();
    const speaker = speakers[line.speaker] ?? speakers.narrator;
    this.elements.speakerAvatar.src = speaker.avatar;
    this.elements.speakerName.textContent = speaker.name;
    this.elements.speakerRole.textContent = speaker.role;
    this.elements.dialogueText.textContent = line.text;
    this.elements.subtitleSpeaker.textContent = speaker.name;
    this.elements.subtitleText.textContent = line.text;
    this.elements.subtitlePanel.classList.remove("subtitle-card-hidden");
  }

  setDialogue(lines, speakers) {
    const line = lines?.[lines.length - 1];
    this.setDialogueLine(line, speakers);
  }

  hideSubtitle() {
    this.clearSubtitleTimeout();
    this.elements.subtitlePanel.classList.add("subtitle-card-hidden");
  }

  clearSubtitleTimeout() {
    if (this.subtitleTimeoutId) {
      window.clearTimeout(this.subtitleTimeoutId);
      this.subtitleTimeoutId = null;
    }
  }

  scheduleSubtitleHide(delayMs = 3000) {
    this.clearSubtitleTimeout();
    this.subtitleTimeoutId = window.setTimeout(() => {
      this.elements.subtitlePanel.classList.add("subtitle-card-hidden");
      this.subtitleTimeoutId = null;
    }, delayMs);
  }

  showMessage({ kicker = "Task", title = "", text = "" }) {
    this.hideQuestion();
    this.closeDrawer();
    this.elements.messageKicker.textContent = kicker;
    this.elements.messageTitle.textContent = title;
    this.elements.messageText.textContent = text;
    this.elements.messagePanel.classList.remove("message-card-hidden");
    this.updateCanvasState();
  }

  hideMessage() {
    this.elements.messagePanel.classList.add("message-card-hidden");
    this.updateCanvasState();
  }

  renderAudioState(enabled) {
    this.elements.audioButton.innerHTML = enabled
      ? '<span aria-hidden="true">&#128266;</span><span class="sr-only">Audio on</span>'
      : '<span aria-hidden="true">&#128263;</span><span class="sr-only">Audio off</span>';
    this.elements.audioButton.setAttribute("aria-label", enabled ? "Audio on" : "Audio off");
    this.elements.audioButton.setAttribute("title", enabled ? "Audio on" : "Audio off");
  }

  renderSettings(settings) {
    this.elements.difficultyOptions.innerHTML = "";

    for (const mode of this.story.meta.difficultyModes ?? []) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "settings-option";
      button.dataset.difficultyId = mode.id;
      button.classList.toggle("is-selected", mode.id === settings.difficulty);
      button.innerHTML = `
        <span class="settings-option-label">${mode.label}</span>
        <span class="settings-option-help">${mode.description}</span>
      `;
      this.elements.difficultyOptions.appendChild(button);
    }

    this.elements.audioEnabledInput.checked = settings.audioEnabled;
    this.elements.audioRateInput.value = String(settings.audioRate);
    this.elements.audioRateValue.textContent = `${Math.round(settings.audioRate * 100)}%`;
  }

  render(state, settings) {
    this.renderStartVocabulary(settings);
    this.renderWordsAttention(state.hasUnreadVocabulary());
    this.renderSettings(settings);

    if (!state.started) {
      this.renderVocabularyList(this.getStartVocabulary(), settings, "start");
      this.renderInventory(state);
      this.renderList(this.elements.notesList, [
        "Read the 6 words first.",
        "Then press Start Game."
      ]);
      this.renderProgress(state);
      return;
    }

    const step = state.getCurrentStep();
    this.renderVocabularyList(step.vocabulary, settings, "lesson");
    this.renderInventory(state);
    this.renderList(
      this.elements.notesList,
      state.notes.length > 0 ? state.notes : ["No notes yet."]
    );
    this.renderProgress(state);

    if (state.completed) {
      this.showEnd(state, settings);
    } else {
      this.hideEnd();
    }
  }

  renderWordsAttention(enabled) {
    const wordsButton = this.drawerButtons.find((button) => button.dataset.drawerButton === "words");
    if (!wordsButton) {
      return;
    }
    wordsButton.classList.toggle("has-fresh-words", enabled);
  }

  renderVocabularyList(items, settings, context) {
    this.elements.vocabularyList.innerHTML = "";
    const showTranslation = this.shouldShowTranslation(settings, context);

    for (const item of items) {
      const entry = document.createElement("li");
      entry.innerHTML = `
        <span class="word-term">${item.term}</span>
        <span class="word-definition">${item.definition}</span>
        ${showTranslation && item.translation ? `<span class="word-translation">${item.translation}</span>` : ""}
      `;
      this.elements.vocabularyList.appendChild(entry);
    }
  }

  renderInventory(state) {
    this.elements.inventoryList.innerHTML = "";

    if (state.inventory.length === 0) {
      const item = document.createElement("li");
      item.textContent = "Nothing yet";
      this.elements.inventoryList.appendChild(item);
      return;
    }

    for (const itemId of state.inventory) {
      const definition = state.story.inventoryItems[itemId];
      const item = document.createElement("li");
      item.innerHTML = `
        <img class="inventory-icon" src="${definition.icon}" alt="">
        <span>${definition.label}</span>
      `;
      this.elements.inventoryList.appendChild(item);
    }
  }

  renderProgress(state) {
    this.elements.progressList.innerHTML = "";

    for (const step of state.getProgress()) {
      const item = document.createElement("li");
      if (step.isCurrent) {
        item.classList.add("is-current");
      }
      if (step.isComplete) {
        item.classList.add("is-complete");
      }
      item.innerHTML = `
        <span class="progress-title">${step.title}</span>
        <span class="progress-status">${step.status}</span>
      `;
      this.elements.progressList.appendChild(item);
    }
  }

  renderList(target, items) {
    target.innerHTML = "";

    for (const text of items) {
      const item = document.createElement("li");
      item.textContent = text;
      target.appendChild(item);
    }
  }

  showQuestion(check) {
    this.hideMessage();
    this.closeDrawer();
    this.elements.questionText.textContent = check.question;
    this.elements.questionHelp.textContent = check.help ?? "Choose one answer.";
    this.elements.questionOptions.innerHTML = "";

    for (const option of check.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "question-option";
      button.textContent = option.label;
      button.addEventListener("click", () => {
        this.handlers?.onComprehensionAnswer(check.id, option.id);
      });
      this.elements.questionOptions.appendChild(button);
    }

    this.elements.questionPanel.classList.remove("question-card-hidden");
    this.updateCanvasState();
  }

  hideQuestion() {
    this.elements.questionPanel.classList.add("question-card-hidden");
    this.updateCanvasState();
  }

  toggleDrawer(panelId) {
    if (this.activeDrawerId === panelId) {
      this.closeDrawer();
      return;
    }

    this.openDrawer(panelId);
  }

  openDrawer(panelId) {
    if (!this.elements.questionPanel.classList.contains("question-card-hidden")) {
      return;
    }
    this.hideMessage();
    this.activeDrawerId = panelId;
    this.elements.drawerSheet.classList.remove("drawer-sheet-hidden");

    for (const panel of this.drawerPanels) {
      panel.classList.toggle("is-active", panel.dataset.drawerPanel === panelId);
    }

    for (const button of this.drawerButtons) {
      const isActive = button.dataset.drawerButton === panelId;
      button.classList.toggle("is-active", isActive);
      if (isActive) {
        this.elements.drawerTitle.textContent = button.dataset.drawerTitle ?? "Panel";
      }
    }

    if (panelId === "words" && this.handlers?.onWordsViewed) {
      this.handlers.onWordsViewed();
    }

    this.updateCanvasState();
  }

  closeDrawer() {
    this.activeDrawerId = null;
    this.elements.drawerSheet.classList.add("drawer-sheet-hidden");

    for (const panel of this.drawerPanels) {
      panel.classList.remove("is-active");
    }

    for (const button of this.drawerButtons) {
      button.classList.remove("is-active");
    }

    this.updateCanvasState();
  }

  hideStart() {
    this.elements.startScreen.classList.add("overlay-card-hidden");
    this.updateCanvasState();
  }

  showStart() {
    this.hideMessage();
    this.hideQuestion();
    this.hideSubtitle();
    this.closeDrawer();
    this.elements.startScreen.classList.remove("overlay-card-hidden");
    this.updateCanvasState();
  }

  showEnd(state, settings) {
    this.hideMessage();
    this.hideQuestion();
    this.hideSubtitle();
    this.closeDrawer();
    this.elements.endScreen.classList.remove("overlay-card-hidden");
    this.updateCanvasState();
    const endTitle = this.story.meta?.endTitle ?? "Case solved.";
    const endSummaryLead = this.story.meta?.endSummary ?? "You solved the case.";
    this.elements.endTitle.textContent = endTitle;
    this.elements.endSummary.textContent =
      `${endSummaryLead} You used ${state.hintsUsed} hint${state.hintsUsed === 1 ? "" : "s"} and got ${state.correctChecks}/${(state.story.comprehensionChecks ?? []).length} checks right.`;
    this.elements.starRow.innerHTML = "";

    for (let index = 0; index < 3; index += 1) {
      const star = document.createElement("span");
      star.className = "star";
      star.textContent = index < state.getStars() ? "\u2605" : "\u2606";
      this.elements.starRow.appendChild(star);
    }

    this.elements.reviewStats.innerHTML = "";
    for (const stat of state.getReviewStats()) {
      const card = document.createElement("div");
      card.className = "review-stat";
      card.innerHTML = `
        <span class="review-stat-value">${stat.value}</span>
        <span class="review-stat-label">${stat.label}</span>
      `;
      this.elements.reviewStats.appendChild(card);
    }

    this.renderReviewWords(state.getLearnedVocabulary(), settings);
    this.renderReviewPhrases(state.getReviewPhrases(), settings);
  }

  hideEnd() {
    this.elements.endScreen.classList.add("overlay-card-hidden");
    this.updateCanvasState();
  }

  renderReviewWords(items, settings) {
    this.elements.reviewWords.innerHTML = "";
    const showTranslation = this.shouldShowTranslation(settings, "review");

    if (items.length === 0) {
      const entry = document.createElement("li");
      entry.textContent = "No new words were marked in this run.";
      this.elements.reviewWords.appendChild(entry);
      return;
    }

    for (const item of items) {
      const entry = document.createElement("li");
      entry.innerHTML = `
        <span class="word-term">${item.term}</span>
        <span class="word-definition">${item.definition}</span>
        ${showTranslation && item.translation ? `<span class="word-translation">${item.translation}</span>` : ""}
      `;
      this.elements.reviewWords.appendChild(entry);
    }
  }

  renderReviewPhrases(items, settings) {
    this.elements.reviewPhrases.innerHTML = "";
    const showTranslation = this.shouldShowTranslation(settings, "review");

    if (items.length === 0) {
      const entry = document.createElement("li");
      entry.textContent = "Add review phrases in story.json.";
      this.elements.reviewPhrases.appendChild(entry);
      return;
    }

    for (const phrase of items) {
      const speaker = this.story.speakers[phrase.speaker];
      const entry = document.createElement("li");
      entry.innerHTML = `
        <span class="review-phrase-speaker">${speaker?.name ?? "Guide"}</span>
        <span class="review-phrase-text">${phrase.text}</span>
        ${showTranslation && phrase.translation ? `<span class="review-phrase-translation">${phrase.translation}</span>` : ""}
      `;
      this.elements.reviewPhrases.appendChild(entry);
    }
  }

  updateCanvasState() {
    const uiOpen =
      !this.elements.startScreen.classList.contains("overlay-card-hidden") ||
      !this.elements.endScreen.classList.contains("overlay-card-hidden") ||
      !this.elements.questionPanel.classList.contains("question-card-hidden") ||
      !this.elements.messagePanel.classList.contains("message-card-hidden") ||
      !this.elements.drawerSheet.classList.contains("drawer-sheet-hidden");
    this.elements.canvasShell.classList.toggle("is-ui-open", uiOpen);
  }
}
