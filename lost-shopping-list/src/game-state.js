export class GameState {
  constructor(story) {
    this.story = story;
    this.interactiveById = new Map(story.interactives.map((item) => [item.id, item]));
    this.stepIndexById = new Map(story.steps.map((step, index) => [step.id, index]));
    this.checksById = new Map((story.comprehensionChecks ?? []).map((check) => [check.id, check]));
    this.vocabularyByTerm = new Map();

    for (const item of story.meta.preGameVocab ?? []) {
      if (item?.term) {
        this.vocabularyByTerm.set(item.term, item);
      }
    }

    for (const step of story.steps) {
      for (const item of step.vocabulary ?? []) {
        if (item?.term) {
          this.vocabularyByTerm.set(item.term, item);
        }
      }
    }

    this.reset();
  }

  reset() {
    this.started = false;
    this.completed = false;
    this.currentStepId = this.story.steps[0].id;
    this.inventory = [];
    this.notes = [];
    this.hintLevel = 0;
    this.hintsUsed = 0;
    this.latestDialogue = [];
    this.dialogueHistory = [];
    this.responseTurns = {};
    this.knownVocabularyTerms = new Set();
    this.pendingVocabularyTerms = new Set();
    this.shownCheckIds = new Set();
    this.correctChecks = 0;
    this.incorrectChecks = 0;
    this.wrongInteractionCount = 0;
  }

  startCase() {
    this.reset();
    this.started = true;
    this.notes = (this.story.meta?.startNotes?.length ? this.story.meta.startNotes : [
      "Listen to the clues.",
      "Solve the case."
    ]).slice(0, 6);
    this.queueVocabulary(this.getCurrentStep().vocabulary);
    this.setDialogue(this.story.introLines);
    return this.story.introLines;
  }

  getCurrentStep() {
    return this.story.steps[this.stepIndexById.get(this.currentStepId)];
  }

  getCurrentStepIndex() {
    return this.stepIndexById.get(this.currentStepId);
  }

  setDialogue(lines) {
    this.latestDialogue = lines.map((line) => ({ ...line }));
    this.dialogueHistory.push(...this.latestDialogue);
    this.dialogueHistory = this.dialogueHistory.slice(-20);
  }

  addNote(note) {
    if (!note || this.notes.includes(note)) {
      return;
    }
    this.notes.unshift(note);
    this.notes = this.notes.slice(0, 6);
  }

  addInventoryItems(items = []) {
    for (const item of items) {
      if (!this.inventory.includes(item)) {
        this.inventory.push(item);
      }
    }
  }

  setStep(stepId) {
    if (!stepId || stepId === this.currentStepId) {
      return;
    }
    this.currentStepId = stepId;
    this.hintLevel = 0;
    this.queueVocabulary(this.getCurrentStep().vocabulary);
  }

  queueVocabulary(items = []) {
    this.pendingVocabularyTerms.clear();
    for (const item of items) {
      if (!item?.term || this.knownVocabularyTerms.has(item.term)) {
        continue;
      }
      this.pendingVocabularyTerms.add(item.term);
    }
  }

  markCurrentVocabularySeen() {
    if (!this.started) {
      return;
    }

    for (const item of this.getCurrentStep().vocabulary ?? []) {
      if (!item?.term) {
        continue;
      }
      this.knownVocabularyTerms.add(item.term);
      this.pendingVocabularyTerms.delete(item.term);
    }
  }

  hasUnreadVocabulary() {
    return this.started && this.pendingVocabularyTerms.size > 0;
  }

  applyEffects(effects = {}) {
    if (effects.addInventory) {
      this.addInventoryItems(effects.addInventory);
    }

    if (effects.notes) {
      for (const note of effects.notes) {
        this.addNote(note);
      }
    }

    if (effects.step) {
      this.setStep(effects.step);
    }

    if (effects.completeCase) {
      this.completed = true;
    }
  }

  buildWrongInteractionLines(interactive, baseLines, step) {
    const lines = [];
    const lastBaseLine = baseLines?.[baseLines.length - 1];

    if (lastBaseLine) {
      lines.push({ ...lastBaseLine });
    }

    for (const line of step.wrongInteraction?.lines ?? []) {
      lines.push({ ...line });
    }

    return lines;
  }

  getResponseLines(response, responseKey) {
    if (Array.isArray(response.variants) && response.variants.length > 0) {
      const turn = this.responseTurns[responseKey] ?? 0;
      this.responseTurns[responseKey] = turn + 1;
      return response.variants[turn % response.variants.length];
    }

    return response.lines ?? [];
  }

  interact(interactiveId) {
    if (!this.started) {
      const lines = [
        {
          id: "not_started_1",
          speaker: "narrator",
          text: "Press Start Game."
        }
      ];
      this.setDialogue(lines);
      return { lines, interactive: null, stepChanged: false, completed: false };
    }

    const interactive = this.interactiveById.get(interactiveId);

    if (!interactive) {
      return null;
    }

    const step = this.getCurrentStep();
    const directResponse = interactive.responses?.[this.currentStepId];
    const responseKey = interactive.responses?.[this.currentStepId]
      ? `${interactiveId}:${this.currentStepId}`
      : `${interactiveId}:default`;
    const response =
      directResponse ??
      interactive.responses?.default;

    if (!response) {
      return null;
    }

    const previousStepId = this.currentStepId;
    const targetIds = this.getTargetIds();
    const usedWrongInteraction = !directResponse && !targetIds.includes(interactiveId) && Boolean(step.wrongInteraction);
    let lines = this.getResponseLines(response, responseKey);

    if (usedWrongInteraction) {
      this.wrongInteractionCount += 1;
      lines = this.buildWrongInteractionLines(interactive, lines, step);
      if (step.wrongInteraction?.note) {
        this.addNote(step.wrongInteraction.note);
      }
    }

    this.applyEffects(response.effects);
    this.setDialogue(lines);

    return {
      lines,
      interactive,
      stepChanged: previousStepId !== this.currentStepId,
      completed: this.completed,
      usedWrongInteraction
    };
  }

  getPendingComprehensionCheck() {
    if (!this.started || this.completed) {
      return null;
    }

    return (this.story.comprehensionChecks ?? []).find(
      (check) => check.stepId === this.currentStepId && !this.shownCheckIds.has(check.id)
    ) ?? null;
  }

  answerComprehension(checkId, optionId) {
    const check = this.checksById.get(checkId);

    if (!check || this.shownCheckIds.has(checkId)) {
      return null;
    }

    const option = check.options.find((entry) => entry.id === optionId);
    const correct = Boolean(option?.isCorrect);
    const lines = correct ? (check.correctLines ?? []) : (check.wrongLines ?? []);

    this.shownCheckIds.add(checkId);

    if (correct) {
      this.correctChecks += 1;
    } else {
      this.incorrectChecks += 1;
    }

    if (check.notes?.[correct ? "correct" : "wrong"]) {
      this.addNote(check.notes[correct ? "correct" : "wrong"]);
    }

    this.setDialogue(lines);

    return {
      check,
      option,
      correct,
      lines
    };
  }

  requestHint() {
    if (!this.started) {
      const line = {
        id: "hint_wait_1",
        speaker: "narrator",
        text: "Start the game first."
      };
      this.setDialogue([line]);
      return { lines: [line], targetIds: [] };
    }

    if (this.completed) {
      const line = {
        id: "hint_complete_1",
        speaker: "narrator",
        text: "You solved the case. Press Play Again."
      };
      this.setDialogue([line]);
      return { lines: [line], targetIds: [] };
    }

    const step = this.getCurrentStep();
    const hintIndex = Math.min(this.hintLevel, step.hints.length - 1);
    const line = step.hints[hintIndex];

    if (this.hintLevel < step.hints.length) {
      this.hintsUsed += 1;
      this.hintLevel += 1;
    }

    this.setDialogue([line]);
    this.addNote(`Hint: ${line.text}`);

    return {
      lines: [line],
      targetIds: step.targetIds
    };
  }

  getProgress() {
    const currentIndex = this.getCurrentStepIndex();

    return this.story.steps.map((step, index) => {
      let status = "Up next";

      if (this.completed || index < currentIndex) {
        status = "Done";
      } else if (index === currentIndex) {
        status = this.completed ? "Done" : "Current";
      }

      return {
        ...step,
        status,
        isCurrent: !this.completed && index === currentIndex,
        isComplete: this.completed || index < currentIndex
      };
    });
  }

  getTargetIds() {
    if (!this.started || this.completed) {
      return [];
    }
    return this.getCurrentStep().targetIds ?? [];
  }

  getStars() {
    if (this.hintsUsed === 0) {
      return 3;
    }
    if (this.hintsUsed <= 2) {
      return 2;
    }
    return 1;
  }

  getLearnedVocabulary() {
    return Array.from(this.knownVocabularyTerms)
      .map((term) => this.vocabularyByTerm.get(term))
      .filter(Boolean)
      .slice(0, 8);
  }

  getReviewPhrases() {
    return this.story.meta.reviewPhrases ?? [];
  }

  getReviewStats() {
    return [
      {
        label: "Hints",
        value: String(this.hintsUsed)
      },
      {
        label: "Checks",
        value: `${this.correctChecks}/${(this.story.comprehensionChecks ?? []).length}`
      },
      {
        label: "Wrong turns",
        value: String(this.wrongInteractionCount)
      }
    ];
  }
}
