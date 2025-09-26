class HyperCardRuntime extends EventTarget {
  constructor() {
    super();
    this.stack = this.#createDefaultStack();
    this.currentCardIndex = 0;
    this.currentFieldName = this.stack.cards[0]?.fields[0]?.name ?? null;
    this.recentCards = [];
    this.messageLog = [];
    this.variables = { it: '', result: '' };
    this.commandHistory = [];
    this.historyIndex = null;
    this.messageBoxElements = { input: null, output: null };
    this.#loadState();
  }

  initialize() {
    this.#bindCommonUI();
    this.#bindMessageBox();
    this.#bindCardView();
    this.#bindInspectors();
    this.#bindScriptEditor();
    this.#bindPreferences();
    if (this.currentCard) {
      this.#recordMessage('openCard', `card "${this.currentCard.name}"`);
    }
    this.#renderAll();
  }

  get currentCard() {
    return this.stack.cards[this.currentCardIndex];
  }

  #createDefaultStack() {
    return {
      name: 'Demo HyperCard Stack',
      cantModify: false,
      userLevel: 5,
      scriptTextFont: 'Monaco',
      scriptTextSize: 12,
      reportTemplates: ['Default Report', 'Mailing Labels'],
      backgrounds: [
        { id: 1, name: 'Main', rect: [0, 0, 740, 460] }
      ],
      cards: [
        {
          id: 2590,
          name: 'Welcome',
          backgroundId: 1,
          rect: [0, 0, 740, 460],
          fields: [
            { id: 3000, name: 'Title', text: 'Welcome to HyperCard', textFont: 'Geneva', textSize: 12, lockText: false },
            { id: 3001, name: 'Body', text: 'This stack demonstrates a tiny HyperCard-inspired runtime. Use the message box to try commands such as “go next” or “put \'Hello\' into field \'Body\'”.', textFont: 'Geneva', textSize: 12, lockText: false }
          ],
          buttons: [
            {
              id: 4000,
              name: 'Show Tips',
              script: 'on mouseUp\n  answer "HyperCard makes the Macintosh talk."\nend mouseUp'
            }
          ]
        },
        {
          id: 2591,
          name: 'Cards',
          backgroundId: 1,
          rect: [0, 0, 740, 460],
          fields: [
            { id: 3002, name: 'Title', text: 'Cards & Backgrounds', textFont: 'Geneva', textSize: 12, lockText: false },
            { id: 3003, name: 'Body', text: 'Every card shares the background layer, but its own fields can vary. Use Prev/Next to travel, or try “go card 3”.', textFont: 'Geneva', textSize: 12, lockText: false }
          ],
          buttons: [
            {
              id: 4001,
              name: 'Mark Card',
              script: 'on mouseUp\n  put "marked" into card field "Body"\nend mouseUp'
            }
          ]
        },
        {
          id: 2592,
          name: 'Scripting',
          backgroundId: 1,
          rect: [0, 0, 740, 460],
          fields: [
            { id: 3004, name: 'Title', text: 'Scripting', textFont: 'Geneva', textSize: 12, lockText: false },
            { id: 3005, name: 'Body', text: 'Commands update the message log and variable watcher. “beep”, “answer ...”, “put field \'Title\' into field \'Body\'” and more are recognised.', textFont: 'Geneva', textSize: 12, lockText: false }
          ],
          buttons: [
            {
              id: 4002,
              name: 'About',
              script: 'on mouseUp\n  answer "HyperTalk lives!"\nend mouseUp'
            }
          ]
        }
      ]
    };
  }

  #loadState() {
    try {
      const raw = window.localStorage?.getItem('hypercard-demo-state');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.cards)) {
        parsed.cards.forEach(savedCard => {
          const card = this.stack.cards.find(c => c.id === savedCard.id);
          if (!card) return;
          if (typeof savedCard.name === 'string') {
            card.name = savedCard.name;
          }
          if (Array.isArray(savedCard.fields)) {
            savedCard.fields.forEach(savedField => {
              const field = card.fields.find(f => f.id === savedField.id);
              if (field && typeof savedField.text === 'string') {
                field.text = savedField.text;
              }
            });
          }
        });
      }
      if (typeof parsed.userLevel === 'number') {
        this.stack.userLevel = parsed.userLevel;
      }
      if (typeof parsed.scriptTextFont === 'string') {
        this.stack.scriptTextFont = parsed.scriptTextFont;
      }
      if (typeof parsed.scriptTextSize === 'number') {
        this.stack.scriptTextSize = parsed.scriptTextSize;
      }
      if (typeof parsed.currentCardIndex === 'number') {
        this.currentCardIndex = Math.max(0, Math.min(parsed.currentCardIndex, this.stack.cards.length - 1));
      }
      if (typeof parsed.currentFieldName === 'string') {
        this.currentFieldName = parsed.currentFieldName;
      }
    } catch (error) {
      console.warn('Unable to load saved HyperCard state', error);
    }
  }

  #saveState() {
    try {
      const snapshot = {
        userLevel: this.stack.userLevel,
        scriptTextFont: this.stack.scriptTextFont,
        scriptTextSize: this.stack.scriptTextSize,
        currentCardIndex: this.currentCardIndex,
        currentFieldName: this.currentFieldName,
        cards: this.stack.cards.map(card => ({
          id: card.id,
          name: card.name,
          fields: card.fields.map(field => ({ id: field.id, text: field.text }))
        }))
      };
      window.localStorage?.setItem('hypercard-demo-state', JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Unable to save HyperCard state', error);
    }
  }

  #bindCommonUI() {
    const tools = document.querySelectorAll('.tool');
    if (tools.length) {
      tools.forEach(btn => btn.addEventListener('click', () => {
        tools.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      }));
    }

    document.querySelectorAll('[data-action="toggle-message-box"]').forEach(el => {
      el.addEventListener('click', event => {
        event.preventDefault();
        this.#toggleMessageBox();
      });
    });

    document.querySelectorAll('[data-action="toggle-tools"]').forEach(el => {
      el.addEventListener('click', event => {
        event.preventDefault();
        const toolsPane = document.querySelector('.hc-tools');
        if (!toolsPane) return;
        const willHide = toolsPane.style.display !== 'none';
        toolsPane.style.display = willHide ? 'none' : 'block';
        const main = document.querySelector('.hc-main');
        if (main) {
          main.style.gridTemplateColumns = willHide ? '0 1fr' : '160px 1fr';
        }
      });
    });

    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        this.#toggleMessageBox();
      }
    });
  }

  #toggleMessageBox() {
    const messageBox = document.querySelector('.hc-message-box');
    if (!messageBox) return;
    messageBox.hidden = !messageBox.hidden;
    if (!messageBox.hidden) {
      this.messageBoxElements.input?.focus();
    }
  }

  #bindMessageBox() {
    const input = document.getElementById('mb-input');
    const output = document.getElementById('mb-output');
    if (!input || !output) return;

    this.messageBoxElements = { input, output };

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const line = input.value.trim();
        if (!line) return;
        this.commandHistory.push(line);
        this.historyIndex = null;
        const response = this.#executeCommand(line);
        this.#setMessageBoxOutput(response);
        input.value = '';
        this.#saveState();
      } else if (event.key === 'ArrowUp') {
        if (!this.commandHistory.length) return;
        event.preventDefault();
        if (this.historyIndex === null) {
          this.historyIndex = this.commandHistory.length - 1;
        } else if (this.historyIndex > 0) {
          this.historyIndex -= 1;
        }
        input.value = this.commandHistory[this.historyIndex];
      } else if (event.key === 'ArrowDown') {
        if (this.historyIndex === null) return;
        event.preventDefault();
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex += 1;
          input.value = this.commandHistory[this.historyIndex];
        } else {
          this.historyIndex = null;
          input.value = '';
        }
      }
    });
  }

  #executeCommand(line) {
    this.#recordMessage('command', line);
    const trimmed = line.trim();
    if (!trimmed) {
      return '';
    }
    const lower = trimmed.toLowerCase();

    if (lower === 'beep') {
      this.variables.it = '';
      this.variables.result = '';
      this.#updateVariableWatcher();
      return '🔔 (beep)';
    }

    if (lower.startsWith('go ')) {
      const handled = this.#handleGoCommand(trimmed);
      this.#updateVariableWatcher();
      return handled ?? `Unknown navigation: ${trimmed}`;
    }

    const putMatch = trimmed.match(/^put\s+(.+?)\s+into\s+card\s+field\s+"([^"]+)"$/i) || trimmed.match(/^put\s+(.+?)\s+into\s+field\s+"([^"]+)"$/i);
    if (putMatch) {
      const value = this.#evaluateExpression(putMatch[1]);
      const fieldName = putMatch[2];
      const success = this.#setFieldText(fieldName, value, { log: true });
      if (!success) {
        this.variables.result = `Can't find field "${fieldName}"`;
        this.#updateVariableWatcher();
        return this.variables.result;
      }
      this.variables.it = value;
      this.variables.result = '';
      this.#renderCardFields();
      this.#updateInspectors();
      this.#updateVariableWatcher();
      this.#saveState();
      return value;
    }

    const getFieldMatch = trimmed.match(/^get\s+card\s+field\s+"([^"]+)"$/i) || trimmed.match(/^get\s+field\s+"([^"]+)"$/i);
    if (getFieldMatch) {
      const fieldName = getFieldMatch[1];
      const fieldText = this.#getFieldText(fieldName);
      this.variables.it = fieldText;
      this.variables.result = '';
      this.#updateVariableWatcher();
      return fieldText;
    }

    const answerMatch = trimmed.match(/^answer\s+(.+)/i);
    if (answerMatch) {
      const message = this.#evaluateExpression(answerMatch[1]);
      this.variables.it = 'OK';
      this.variables.result = '';
      this.#updateVariableWatcher();
      return `answer "${message}" (simulated)`;
    }

    const findMatch = trimmed.match(/^find\s+(.+)/i);
    if (findMatch) {
      const query = this.#evaluateExpression(findMatch[1]);
      const outcome = this.#findAndGo(query);
      this.#updateVariableWatcher();
      return outcome ? `found "${query}"` : `Couldn't find "${query}"`;
    }

    this.variables.it = '';
    this.variables.result = trimmed;
    this.#updateVariableWatcher();
    return `sent line: ${trimmed}`;
  }

  #handleGoCommand(command) {
    const matchCardNumber = command.match(/^go\s+card\s+(\d+)/i);
    if (matchCardNumber) {
      const number = Number(matchCardNumber[1]);
      if (!Number.isNaN(number) && number >= 1 && number <= this.stack.cards.length) {
        this.#goToCard(number - 1, 'card number');
        return `→ went to card ${number}`;
      }
      this.variables.result = `Can't go to card ${matchCardNumber[1]}`;
      return this.variables.result;
    }

    const matchCardName = command.match(/^go\s+card\s+"([^"]+)"/i);
    if (matchCardName) {
      const name = matchCardName[1].toLowerCase();
      const index = this.stack.cards.findIndex(card => card.name.toLowerCase() === name);
      if (index >= 0) {
        this.#goToCard(index, 'card name');
        return `→ went to card "${this.stack.cards[index].name}"`;
      }
      this.variables.result = `Can't find that card`;
      return this.variables.result;
    }

    if (/go\s+next/i.test(command)) {
      this.#goToCard((this.currentCardIndex + 1) % this.stack.cards.length, 'next');
      return '→ went to next card';
    }

    if (/go\s+(previous|prev)/i.test(command)) {
      const nextIndex = (this.currentCardIndex - 1 + this.stack.cards.length) % this.stack.cards.length;
      this.#goToCard(nextIndex, 'previous');
      return '→ went to previous card';
    }

    if (/go\s+first/i.test(command)) {
      this.#goToCard(0, 'first');
      return '→ went to first card';
    }

    if (/go\s+last/i.test(command)) {
      this.#goToCard(this.stack.cards.length - 1, 'last');
      return '→ went to last card';
    }

    if (/go\s+recent/i.test(command)) {
      const recent = this.recentCards.shift();
      if (recent) {
        const index = this.stack.cards.findIndex(card => card.id === recent);
        if (index >= 0) {
          this.#goToCard(index, 'recent');
          return '→ went to recent card';
        }
      }
      this.variables.result = 'no recent card';
      return 'No recent card';
    }

    return null;
  }

  #evaluateExpression(expr) {
    const trimmed = expr.trim();
    const quoted = trimmed.match(/^"([\s\S]*)"$/);
    if (quoted) {
      return quoted[1];
    }
    const fieldExpr = trimmed.match(/^card\s+field\s+"([^"]+)"$/i) || trimmed.match(/^field\s+"([^"]+)"$/i);
    if (fieldExpr) {
      return this.#getFieldText(fieldExpr[1]);
    }
    if (/^the\s+name\s+of\s+this\s+card$/i.test(trimmed)) {
      return this.currentCard?.name ?? '';
    }
    if (/^the\s+number\s+of\s+cards$/i.test(trimmed)) {
      return String(this.stack.cards.length);
    }
    if (/^the\s+result$/i.test(trimmed)) {
      return this.variables.result;
    }
    if (/^it$/i.test(trimmed)) {
      return this.variables.it;
    }
    return trimmed;
  }

  #bindCardView() {
    const cardPane = document.querySelector('.hc-card');
    if (!cardPane) return;

    document.querySelectorAll('[data-nav]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        const dir = button.getAttribute('data-nav');
        if (dir === 'next') {
          this.#goToCard((this.currentCardIndex + 1) % this.stack.cards.length, 'next');
        } else if (dir === 'prev' || dir === 'previous') {
          const nextIndex = (this.currentCardIndex - 1 + this.stack.cards.length) % this.stack.cards.length;
          this.#goToCard(nextIndex, 'previous');
        }
      });
    });

    document.querySelectorAll('[data-action="go-first"]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        this.#goToCard(0, 'first button');
      });
    });

    document.querySelectorAll('[data-action="go-recent"]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        const recent = this.recentCards.shift();
        if (recent) {
          const index = this.stack.cards.findIndex(card => card.id === recent);
          if (index >= 0) {
            this.#goToCard(index, 'recent button');
            return;
          }
        }
        this.#setMessageBoxOutput('No recent card');
      });
    });

    document.querySelectorAll('[data-action="find"]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        const query = window.prompt('Find text:');
        if (!query) {
          this.variables.result = 'cancel';
          this.#updateVariableWatcher();
          return;
        }
        const found = this.#findAndGo(query);
        this.#setMessageBoxOutput(found ? `found "${query}"` : `Couldn't find "${query}"`);
      });
    });

    const fieldElements = document.querySelectorAll('[data-field]');
    fieldElements.forEach(element => {
      element.addEventListener('focus', () => {
        const fieldName = element.getAttribute('data-field');
        if (!fieldName) return;
        this.currentFieldName = fieldName;
        this.#recordMessage('openField', `field "${fieldName}"`);
        this.#updateInspectors();
        this.#saveState();
      });
      element.addEventListener('blur', () => {
        const fieldName = element.getAttribute('data-field');
        if (!fieldName) return;
        this.#recordMessage('closeField', `field "${fieldName}"`);
        this.#updateInspectors();
        this.#saveState();
      });
      element.addEventListener('input', () => {
        const fieldName = element.getAttribute('data-field');
        if (!fieldName) return;
        this.#setFieldText(fieldName, element.textContent ?? '', { log: false, skipRender: true });
        this.#updateInspectors();
      });
    });
  }

  #bindInspectors() {
    const containers = document.querySelectorAll('[data-inspector]');
    if (!containers.length) return;
    this.#updateInspectors();
  }

  #bindScriptEditor() {
    const scriptArea = document.querySelector('[data-role="script-source"]');
    if (!scriptArea) return;
    const button = this.currentCard?.buttons?.[0];
    if (button) {
      scriptArea.value = button.script;
      scriptArea.dataset.buttonId = String(button.id);
    }
    this.#applyScriptEditorPreferences(scriptArea);
    scriptArea.addEventListener('input', () => {
      const id = Number(scriptArea.dataset.buttonId);
      if (!id) return;
      const card = this.currentCard;
      const target = card?.buttons?.find(btn => btn.id === id);
      if (!target) return;
      target.script = scriptArea.value;
      this.#recordMessage('scriptEdited', `button "${target.name}"`);
      this.#saveState();
    });
  }

  #bindPreferences() {
    const levelSelect = document.querySelector('[data-pref="user-level"]');
    if (levelSelect) {
      levelSelect.value = String(this.stack.userLevel);
      levelSelect.addEventListener('change', () => {
        const value = Number(levelSelect.value);
        if (!Number.isNaN(value) && value >= 1 && value <= 5) {
          this.stack.userLevel = value;
          this.#recordMessage('userLevelChanged', `userLevel = ${value}`);
          this.#updateVariableWatcher();
          this.#saveState();
        }
      });
    }

    const fontInput = document.querySelector('[data-pref="script-font"]');
    if (fontInput) {
      fontInput.value = this.stack.scriptTextFont;
      fontInput.addEventListener('change', () => {
        if (!fontInput.value.trim()) return;
        this.stack.scriptTextFont = fontInput.value.trim();
        this.#recordMessage('setProperty', `scriptTextFont = ${this.stack.scriptTextFont}`);
        this.#applyScriptEditorPreferences();
        this.#saveState();
      });
    }

    const sizeInput = document.querySelector('[data-pref="script-size"]');
    if (sizeInput) {
      sizeInput.value = String(this.stack.scriptTextSize);
      sizeInput.addEventListener('change', () => {
        const value = Number(sizeInput.value);
        if (!Number.isNaN(value) && value > 0) {
          this.stack.scriptTextSize = value;
          this.#recordMessage('setProperty', `scriptTextSize = ${value}`);
          this.#applyScriptEditorPreferences();
          this.#saveState();
        }
      });
    }
  }

  #renderAll() {
    this.#renderCardView();
    this.#updateInspectors();
    this.#updateMessageWatcher();
    this.#updateVariableWatcher();
  }

  #renderCardView() {
    const badge = document.querySelector('[data-role="card-badge"]');
    const card = this.currentCard;
    if (badge && card) {
      const background = this.stack.backgrounds.find(bg => bg.id === card.backgroundId);
      badge.textContent = `Card ${this.currentCardIndex + 1} of ${this.stack.cards.length} · Background: ${background?.name ?? '—'}`;
    }
    this.#renderCardFields();
    this.#renderEventStream();
  }

  #renderCardFields() {
    const card = this.currentCard;
    if (!card) return;
    document.querySelectorAll('[data-field]').forEach(element => {
      const fieldName = element.getAttribute('data-field');
      if (!fieldName) return;
      const field = card.fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
      if (!field) {
        element.textContent = '';
        return;
      }
      if (document.activeElement !== element) {
        element.textContent = field.text;
      }
    });
  }

  #renderEventStream() {
    const container = document.querySelector('[data-role="event-stream"]');
    if (!container) return;
    container.innerHTML = '';
    const recent = this.messageLog.slice(-6);
    recent.forEach(entry => {
      const nameCell = document.createElement('div');
      nameCell.textContent = entry.name;
      const detailCell = document.createElement('div');
      const detail = entry.detail ? entry.detail : '\u00A0';
      detailCell.innerHTML = `<small class="meta">${detail}</small>`;
      container.append(nameCell, detailCell);
    });
  }

  #updateInspectors() {
    const card = this.currentCard;
    if (!card) return;
    this.#fillInspector('card', [
      ['id', card.id],
      ['name', card.name],
      ['number', this.currentCardIndex + 1],
      ['background', this.stack.backgrounds.find(bg => bg.id === card.backgroundId)?.name ?? ''],
      ['rect', card.rect.join(',')],
      ['visible', 'true']
    ]);

    const field = this.#getCurrentField();
    if (field) {
      this.#fillInspector('field', [
        ['id', field.id],
        ['name', field.name],
        ['textFont', field.textFont ?? this.stack.scriptTextFont],
        ['textSize', field.textSize ?? this.stack.scriptTextSize],
        ['lockText', field.lockText ? 'true' : 'false'],
        ['length', field.text.length]
      ]);
    }

    this.#fillInspector('stack', [
      ['name', this.stack.name],
      ['userLevel', this.stack.userLevel],
      ['cantModify', this.stack.cantModify ? 'true' : 'false'],
      ['cardCount', this.stack.cards.length],
      ['reportTemplates', this.stack.reportTemplates.join(', ')]
    ]);
  }

  #fillInspector(type, rows) {
    const container = document.querySelector(`[data-inspector="${type}"]`);
    if (!container) return;
    container.innerHTML = '';
    rows.forEach(([prop, value]) => {
      const row = document.createElement('tr');
      const propCell = document.createElement('td');
      propCell.textContent = prop;
      const valueCell = document.createElement('td');
      valueCell.textContent = String(value);
      row.append(propCell, valueCell);
      container.append(row);
    });
  }

  #updateMessageWatcher() {
    const watcher = document.querySelector('[data-role="message-watcher"]');
    if (!watcher) return;
    const lines = this.messageLog.slice(-12).map(entry => entry.detail ? `${entry.name} — ${entry.detail}` : entry.name);
    watcher.textContent = lines.join('\n');
  }

  #updateVariableWatcher() {
    const watcher = document.querySelector('[data-role="variable-watcher"]');
    if (!watcher) return;
    const lines = [
      `userLevel = ${this.stack.userLevel}`,
      `it = "${this.variables.it}"`,
      `the result = "${this.variables.result}"`,
      `currentCard = ${this.currentCardIndex + 1}`
    ];
    if (this.recentCards.length) {
      lines.push(`recentCards = ${this.recentCards.join(', ')}`);
    }
    watcher.textContent = lines.join('\n');
  }

  #applyScriptEditorPreferences(scriptArea = document.querySelector('[data-role="script-source"]')) {
    if (!scriptArea) return;
    scriptArea.style.fontFamily = this.stack.scriptTextFont;
    scriptArea.style.fontSize = `${this.stack.scriptTextSize}px`;
  }

  #recordMessage(name, detail = '') {
    this.messageLog.push({ name, detail });
    if (this.messageLog.length > 40) {
      this.messageLog.shift();
    }
    this.#renderEventStream();
    this.#updateMessageWatcher();
  }

  #setFieldText(fieldName, text, options = {}) {
    const card = this.currentCard;
    if (!card) return false;
    const field = card.fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
    if (!field) return false;
    field.text = text;
    this.currentFieldName = field.name;
    if (!options.skipRender) {
      this.#renderCardFields();
    }
    if (options.log) {
      this.#recordMessage('setField', `field "${field.name}"`);
    }
    return true;
  }

  #getFieldText(fieldName) {
    const card = this.currentCard;
    if (!card) return '';
    const field = card.fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
    return field ? field.text : '';
  }

  #getCurrentField() {
    const name = this.currentFieldName;
    if (!name) return this.currentCard?.fields?.[0] ?? null;
    return this.currentCard?.fields?.find(f => f.name === name) ?? this.currentCard?.fields?.[0] ?? null;
  }

  #goToCard(index, reason) {
    if (index === this.currentCardIndex) return;
    const oldCard = this.currentCard;
    if (oldCard) {
      this.#recordMessage('closeCard', `card "${oldCard.name}"`);
      this.recentCards = [oldCard.id, ...this.recentCards].slice(0, 20);
    }
    this.currentCardIndex = index;
    const card = this.currentCard;
    if (card) {
      this.#recordMessage('openCard', `card "${card.name}"`);
    }
    this.currentFieldName = card?.fields?.[0]?.name ?? null;
    this.variables.it = '';
    this.variables.result = '';
    this.#renderCardView();
    this.#updateInspectors();
    this.#updateVariableWatcher();
    this.#saveState();
  }

  #findAndGo(query) {
    const lower = query.toLowerCase();
    const index = this.stack.cards.findIndex(card => card.fields.some(field => field.text.toLowerCase().includes(lower)));
    if (index >= 0) {
      this.variables.it = query;
      this.variables.result = '';
      this.#goToCard(index, 'find');
      this.#recordMessage('find', `"${query}"`);
      return true;
    }
    this.variables.result = 'not found';
    this.#updateVariableWatcher();
    return false;
  }

  #setMessageBoxOutput(text) {
    if (this.messageBoxElements.output) {
      this.messageBoxElements.output.value = text;
    }
  }
}

const runtime = new HyperCardRuntime();
runtime.initialize();
window.hypercard = runtime;
