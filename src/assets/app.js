// OxideReader - Application Logic
(function () {
  'use strict';

  // --- State ---
  const state = {
    bookMeta: null,
    currentSpineIndex: 0,
    recolorEnabled: true,
    fontSize: 18,
    mode: 'normal', // 'normal' | 'command' | 'search' | 'index' | 'help'
    pendingKey: null,
    pendingTimer: null,
    tocItems: [],
    tocSelectedIndex: 0,
    searchQuery: '',
    searchMatches: [],
    currentSearchMatchIndex: -1,
  };

  // --- DOM Elements ---
  const readerFrame = document.getElementById('reader-frame');
  const loadingIndicator = document.getElementById('loading-indicator');
  const statusTitle = document.getElementById('status-title');
  const statusChapter = document.getElementById('status-chapter');
  const statusScroll = document.getElementById('status-scroll');
  const statusZoom = document.getElementById('status-zoom');
  const statusRecolor = document.getElementById('status-recolor');
  const statusMode = document.getElementById('status-mode');
  const notification = document.getElementById('notification');
  const indexOverlay = document.getElementById('index-overlay');
  const indexList = document.getElementById('index-list');
  const indexCount = document.getElementById('index-count');
  const helpOverlay = document.getElementById('help-overlay');
  const inputbar = document.getElementById('inputbar');
  const inputbarPrefix = document.getElementById('inputbar-prefix');
  const inputbarInput = document.getElementById('inputbar-input');
  const completionBox = document.getElementById('completion-box');

  // --- Available Commands for Autocomplete ---
  const COMMANDS = [
    { name: 'goto', desc: 'Ir para capítulo (:goto <número>)' },
    { name: 'page', desc: 'Ir para capítulo (:page <número>)' },
    { name: 'toc', desc: 'Abrir índice de capítulos' },
    { name: 'index', desc: 'Abrir índice de capítulos' },
    { name: 'recolor', desc: 'Alternar modo recolor Gruvbox' },
    { name: 'font', desc: 'Ajustar tamanho da fonte (:font 18)' },
    { name: 'help', desc: 'Mostrar atalhos de teclado' },
    { name: 'top', desc: 'Rolar até o topo do capítulo' },
    { name: 'bottom', desc: 'Rolar até o final do capítulo' },
  ];

  // --- Notifications ---
  let notificationTimer = null;
  function showNotification(msg, type = 'info', duration = 3000) {
    if (notificationTimer) clearTimeout(notificationTimer);
    notification.textContent = msg;
    notification.className = type;
    notification.style.display = 'block';
    notificationTimer = setTimeout(() => {
      notification.style.display = 'none';
    }, duration);
  }

  // --- LocalStorage Persistence ---
  function saveState() {
    if (!state.bookMeta) return;
    const saveKey = `oxidereader_${encodeURIComponent(state.bookMeta.title)}`;
    const data = {
      spineIndex: state.currentSpineIndex,
      recolorEnabled: state.recolorEnabled,
      fontSize: state.fontSize,
    };
    try {
      localStorage.setItem(saveKey, JSON.stringify(data));
    } catch (_) {}
  }

  function loadSavedState() {
    if (!state.bookMeta) return;
    const saveKey = `oxidereader_${encodeURIComponent(state.bookMeta.title)}`;
    try {
      const saved = localStorage.getItem(saveKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.spineIndex === 'number' && parsed.spineIndex < state.bookMeta.spine_count) {
          state.currentSpineIndex = parsed.spineIndex;
        }
        if (typeof parsed.recolorEnabled === 'boolean') {
          state.recolorEnabled = parsed.recolorEnabled;
        }
        if (typeof parsed.fontSize === 'number') {
          state.fontSize = parsed.fontSize;
        }
      }
    } catch (_) {}
  }

  // --- Recolor & Typography Injections ---
  function applyIframeStyles() {
    const doc = readerFrame.contentDocument;
    if (!doc || !doc.head) return;

    let styleTag = doc.getElementById('zathura-injected-style');
    if (!styleTag) {
      styleTag = doc.createElement('style');
      styleTag.id = 'zathura-injected-style';
      doc.head.appendChild(styleTag);
    }

    if (state.recolorEnabled) {
      styleTag.textContent = `
        html {
          background-color: rgba(251, 241, 199, 1) !important;
          color: rgba(60, 56, 54, 1) !important;
          scroll-behavior: smooth;
        }
        body {
          background-color: rgba(251, 241, 199, 1) !important;
          color: rgba(60, 56, 54, 1) !important;
          max-width: 780px !important;
          margin: 0 auto !important;
          padding: 40px 24px 100px 24px !important;
          font-family: "Merriweather", "Georgia", "Iosevka Etoile", serif !important;
          font-size: ${state.fontSize}px !important;
          line-height: 1.8 !important;
          word-break: break-word;
        }
        p, span, div, li, blockquote, em, strong, i, b, cite, dd, dt {
          color: rgba(60, 56, 54, 1) !important;
        }
        h1, h2, h3, h4, h5, h6 {
          color: rgba(60, 56, 54, 1) !important;
          font-family: inherit !important;
          line-height: 1.3 !important;
          margin-top: 1.8em !important;
          margin-bottom: 0.8em !important;
        }
        a {
          color: rgba(7, 102, 120, 1) !important;
          text-decoration: underline !important;
        }
        img, svg, picture {
          mix-blend-mode: multiply !important;
          filter: contrast(1.05) !important;
          max-width: 100% !important;
          height: auto !important;
          margin: 1.5em auto !important;
          display: block !important;
        }
        hr {
          border: none;
          border-top: 1px solid rgba(213, 196, 161, 1) !important;
          margin: 2em 0 !important;
        }
        ::selection {
          background-color: rgba(181, 118, 20, 0.4) !important;
          color: rgba(60, 56, 54, 1) !important;
        }
        .zathura-search-match {
          background-color: rgba(181, 118, 20, 0.5) !important;
          border-radius: 2px;
        }
        .zathura-search-match.active {
          background-color: rgba(175, 58, 3, 0.6) !important;
          color: #fff !important;
        }
      `;
    } else {
      styleTag.textContent = `
        body {
          max-width: 780px !important;
          margin: 0 auto !important;
          padding: 40px 24px 100px 24px !important;
          font-size: ${state.fontSize}px !important;
          line-height: 1.8 !important;
        }
        .zathura-search-match {
          background-color: rgba(181, 118, 20, 0.5) !important;
        }
        .zathura-search-match.active {
          background-color: rgba(175, 58, 3, 0.6) !important;
        }
      `;
    }

    // Update status indicators
    statusRecolor.className = `status-badge ${state.recolorEnabled ? 'recolor-on' : ''}`;
    statusRecolor.textContent = state.recolorEnabled ? '[RECOLOR: ON]' : '[RECOLOR: OFF]';
    statusZoom.textContent = `[${Math.round((state.fontSize / 18) * 100)}%]`;
  }

  // --- Status Bar Updates ---
  function updateScrollStatus() {
    const doc = readerFrame.contentDocument;
    const win = readerFrame.contentWindow;
    if (!doc || !win) return;

    const scrollTop = win.scrollY || doc.documentElement.scrollTop || 0;
    const scrollHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight || 1;
    const clientHeight = win.innerHeight || doc.documentElement.clientHeight || 1;

    let pct = 0;
    if (scrollHeight > clientHeight) {
      pct = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    } else {
      pct = 100;
    }
    pct = Math.max(0, Math.min(100, pct));
    statusScroll.textContent = `[${pct}%]`;
  }

  function updateStatusbar() {
    if (!state.bookMeta) return;

    statusTitle.textContent = `${state.bookMeta.title} — ${state.bookMeta.author}`;
    statusChapter.textContent = `[Cap. ${state.currentSpineIndex + 1}/${state.bookMeta.spine_count}]`;
    statusMode.textContent = `[${state.mode.toUpperCase()}]`;
    updateScrollStatus();
  }

  // --- Chapter Navigation ---
  function loadChapter(index, targetAnchor = null) {
    if (!state.bookMeta || index < 0 || index >= state.bookMeta.spine_count) return;

    state.currentSpineIndex = index;
    saveState();

    const item = state.bookMeta.spine[index];
    if (!item) return;

    loadingIndicator.style.display = 'block';

    let url = `/book/${item.href}`;
    if (targetAnchor) {
      url += `#${targetAnchor}`;
    }

    readerFrame.src = url;
    updateStatusbar();
  }

  function nextChapter() {
    if (state.currentSpineIndex + 1 < state.bookMeta.spine_count) {
      loadChapter(state.currentSpineIndex + 1);
      showNotification(`Capítulo ${state.currentSpineIndex + 1}/${state.bookMeta.spine_count}`);
    } else {
      showNotification('Você já está no último capítulo.', 'warning');
    }
  }

  function prevChapter() {
    if (state.currentSpineIndex > 0) {
      loadChapter(state.currentSpineIndex - 1);
      showNotification(`Capítulo ${state.currentSpineIndex + 1}/${state.bookMeta.spine_count}`);
    } else {
      showNotification('Você já está no primeiro capítulo.', 'warning');
    }
  }

  // --- Scrolling Helpers ---
  function scrollBy(deltaY) {
    const win = readerFrame.contentWindow;
    if (win) {
      win.scrollBy({ top: deltaY, behavior: 'smooth' });
    }
  }

  function scrollToTop() {
    const win = readerFrame.contentWindow;
    if (win) {
      win.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function scrollToBottom() {
    const win = readerFrame.contentWindow;
    const doc = readerFrame.contentDocument;
    if (win && doc) {
      win.scrollTo({ top: doc.documentElement.scrollHeight, behavior: 'smooth' });
    }
  }

  // --- Index Mode (TOC) ---
  function buildTocFlatList(items, depth = 0) {
    let result = [];
    for (const item of items) {
      result.push({
        title: item.title,
        href: item.href,
        spine_index: item.spine_index,
        depth: depth,
      });
      if (item.children && item.children.length > 0) {
        result = result.concat(buildTocFlatList(item.children, depth + 1));
      }
    }
    return result;
  }

  function renderIndexList() {
    indexList.innerHTML = '';
    state.tocItems.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = `index-item ${idx === state.tocSelectedIndex ? 'active' : ''}`;
      li.style.paddingLeft = `${18 + item.depth * 20}px`;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'index-item-title';
      titleSpan.textContent = item.title;

      const pageSpan = document.createElement('span');
      pageSpan.className = 'index-item-page';
      pageSpan.textContent = item.spine_index !== null ? `Cap. ${item.spine_index + 1}` : '';

      li.appendChild(titleSpan);
      li.appendChild(pageSpan);

      li.addEventListener('click', () => {
        state.tocSelectedIndex = idx;
        activateSelectedTocItem();
      });

      indexList.appendChild(li);
    });

    // Ensure selected item is scrolled into view
    const selectedEl = indexList.children[state.tocSelectedIndex];
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function toggleIndexMode() {
    if (state.mode === 'index') {
      indexOverlay.style.display = 'none';
      state.mode = 'normal';
    } else {
      closeHelp();
      closeInputbar();
      state.mode = 'index';
      indexOverlay.style.display = 'block';

      // Auto select current chapter in TOC
      const currentIdx = state.tocItems.findIndex(
        (t) => t.spine_index === state.currentSpineIndex
      );
      if (currentIdx !== -1) {
        state.tocSelectedIndex = currentIdx;
      }
      renderIndexList();
    }
    updateStatusbar();
  }

  function activateSelectedTocItem() {
    const item = state.tocItems[state.tocSelectedIndex];
    if (item && item.spine_index !== null) {
      const parts = item.href.split('#');
      const anchor = parts.length > 1 ? parts[1] : null;
      loadChapter(item.spine_index, anchor);
      toggleIndexMode();
    } else {
      showNotification('Capítulo não vinculado', 'warning');
    }
  }

  // --- Help Modal ---
  function toggleHelp() {
    if (state.mode === 'help') {
      closeHelp();
    } else {
      closeInputbar();
      if (state.mode === 'index') indexOverlay.style.display = 'none';
      state.mode = 'help';
      helpOverlay.style.display = 'block';
    }
    updateStatusbar();
  }

  function closeHelp() {
    if (state.mode === 'help') {
      helpOverlay.style.display = 'none';
      state.mode = 'normal';
      updateStatusbar();
    }
  }

  // --- Inputbar & Commands ---
  function openInputbar(prefix = ':') {
    closeHelp();
    if (state.mode === 'index') {
      indexOverlay.style.display = 'none';
    }
    state.mode = prefix === '/' ? 'search' : 'command';
    inputbarPrefix.textContent = prefix;
    inputbarInput.value = '';
    inputbar.style.display = 'flex';
    inputbarInput.focus();
    updateCompletion();
    updateStatusbar();
  }

  function closeInputbar() {
    inputbar.style.display = 'none';
    completionBox.style.display = 'none';
    inputbarInput.value = '';
    if (state.mode === 'command' || state.mode === 'search') {
      state.mode = 'normal';
    }
    updateStatusbar();
    readerFrame.focus();
  }

  function updateCompletion() {
    if (state.mode !== 'command') {
      completionBox.style.display = 'none';
      return;
    }

    const val = inputbarInput.value.trim().toLowerCase();
    const matches = COMMANDS.filter((cmd) => cmd.name.startsWith(val));

    if (matches.length > 0 && val.length > 0) {
      completionBox.innerHTML = '';
      matches.forEach((cmd, idx) => {
        const item = document.createElement('div');
        item.className = `completion-item ${idx === 0 ? 'selected' : ''}`;
        item.innerHTML = `<strong>:${cmd.name}</strong><span class="desc">${cmd.desc}</span>`;
        item.addEventListener('click', () => {
          inputbarInput.value = cmd.name + ' ';
          inputbarInput.focus();
          updateCompletion();
        });
        completionBox.appendChild(item);
      });
      completionBox.style.display = 'block';
    } else {
      completionBox.style.display = 'none';
    }
  }

  function executeCommand(inputStr) {
    const raw = inputStr.trim();
    if (!raw) return;

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch (cmd) {
      case 'goto':
      case 'page': {
        const num = parseInt(arg, 10);
        if (!isNaN(num) && num >= 1 && num <= state.bookMeta.spine_count) {
          loadChapter(num - 1);
          showNotification(`Capítulo ${num}/${state.bookMeta.spine_count}`);
        } else {
          showNotification(`Número de capítulo inválido (1 a ${state.bookMeta.spine_count})`, 'error');
        }
        break;
      }
      case 'toc':
      case 'index':
        toggleIndexMode();
        break;
      case 'recolor':
        state.recolorEnabled = !state.recolorEnabled;
        applyIframeStyles();
        saveState();
        showNotification(`Recolor ${state.recolorEnabled ? 'ativado' : 'desativado'}`);
        break;
      case 'font': {
        const size = parseInt(arg, 10);
        if (!isNaN(size) && size >= 10 && size <= 40) {
          state.fontSize = size;
          applyIframeStyles();
          saveState();
          showNotification(`Tamanho da fonte: ${size}px`);
        } else {
          showNotification('Uso: :font <10..40>', 'warning');
        }
        break;
      }
      case 'top':
        scrollToTop();
        break;
      case 'bottom':
        scrollToBottom();
        break;
      case 'help':
        toggleHelp();
        break;
      case 'open':
        showNotification('Recurso para abrir novos livros em breve', 'warning');
        break;
      default:
        showNotification(`Comando desconhecido: :${cmd}`, 'error');
        break;
    }
  }

  // --- Text Search in Chapter ---
  function performSearch(query) {
    if (!query) return;
    const win = readerFrame.contentWindow;
    if (!win) return;

    state.searchQuery = query;
    // Native window.find in iframe
    const found = win.find(query, false, false, true, false, false, false);
    if (found) {
      showNotification(`Encontrado: "${query}" (pressione n para próximo)`);
    } else {
      showNotification(`Nenhuma ocorrência de "${query}" encontrada.`, 'warning');
    }
  }

  function findNextSearch(backward = false) {
    if (!state.searchQuery) return;
    const win = readerFrame.contentWindow;
    if (!win) return;

    const found = win.find(state.searchQuery, false, backward, true, false, false, false);
    if (!found) {
      showNotification(`Fim das ocorrências de "${state.searchQuery}"`, 'info');
    }
  }

  // --- Unified Key Listener (Vim / Zathura) ---
  function handleKeyDown(e) {
    // If typing inside the inputbar, let it handle standard keys except Enter / Tab / Esc
    if (state.mode === 'command' || state.mode === 'search') {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeInputbar();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const val = inputbarInput.value;
        const mode = state.mode;
        closeInputbar();
        if (mode === 'command') {
          executeCommand(val);
        } else if (mode === 'search') {
          performSearch(val);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Autocomplete first match
        const val = inputbarInput.value.trim().toLowerCase();
        const matches = COMMANDS.filter((cmd) => cmd.name.startsWith(val));
        if (matches.length > 0) {
          inputbarInput.value = matches[0].name + ' ';
          updateCompletion();
        }
      }
      return;
    }

    // Help Mode Keybindings
    if (state.mode === 'help') {
      if (e.key === 'Escape' || e.key === 'q' || e.key === 'h' || e.key === '?') {
        e.preventDefault();
        closeHelp();
      }
      return;
    }

    // Index Mode Keybindings
    if (state.mode === 'index') {
      if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'q') {
        e.preventDefault();
        toggleIndexMode();
        return;
      }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        state.tocSelectedIndex = Math.min(state.tocSelectedIndex + 1, state.tocItems.length - 1);
        renderIndexList();
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        state.tocSelectedIndex = Math.max(state.tocSelectedIndex - 1, 0);
        renderIndexList();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        activateSelectedTocItem();
        return;
      }
      return;
    }

    // Normal Reader Mode (Zathura / Vim)
    // 1. Two-key chords (e.g. 'gg')
    if (state.pendingKey === 'g') {
      clearTimeout(state.pendingTimer);
      state.pendingKey = null;
      if (e.key === 'g') {
        e.preventDefault();
        scrollToTop();
        return;
      }
    }

    if (e.key === 'g') {
      state.pendingKey = 'g';
      state.pendingTimer = setTimeout(() => {
        state.pendingKey = null;
      }, 700);
      return;
    }

    switch (e.key) {
      // Scrolling
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        scrollBy(70);
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        scrollBy(-70);
        break;
      case 'd':
        if (e.ctrlKey || !e.ctrlKey) {
          e.preventDefault();
          scrollBy(window.innerHeight * 0.5);
        }
        break;
      case 'u':
        if (e.ctrlKey || !e.ctrlKey) {
          e.preventDefault();
          scrollBy(-window.innerHeight * 0.5);
        }
        break;
      case ' ':
        e.preventDefault();
        if (e.shiftKey) {
          scrollBy(-window.innerHeight * 0.85);
        } else {
          scrollBy(window.innerHeight * 0.85);
        }
        break;
      case 'b':
        e.preventDefault();
        scrollBy(-window.innerHeight * 0.85);
        break;
      case 'G':
        e.preventDefault();
        scrollToBottom();
        break;

      // Chapter navigation
      case 'J':
      case 'n':
      case ']':
        e.preventDefault();
        nextChapter();
        break;
      case 'K':
      case 'p':
      case '[':
        e.preventDefault();
        prevChapter();
        break;

      // Recolor toggle
      case 'r':
        e.preventDefault();
        state.recolorEnabled = !state.recolorEnabled;
        applyIframeStyles();
        saveState();
        showNotification(`Recolor ${state.recolorEnabled ? 'ativado' : 'desativado'}`);
        break;

      // Font size adjustment
      case '+':
      case '=':
        e.preventDefault();
        state.fontSize = Math.min(36, state.fontSize + 1);
        applyIframeStyles();
        saveState();
        break;
      case '-':
        e.preventDefault();
        state.fontSize = Math.max(12, state.fontSize - 1);
        applyIframeStyles();
        saveState();
        break;
      case '0':
        e.preventDefault();
        state.fontSize = 18;
        applyIframeStyles();
        saveState();
        showNotification('Fonte restaurada para o padrão (18px)');
        break;

      // TOC / Index Mode
      case 'Tab':
        e.preventDefault();
        toggleIndexMode();
        break;

      // Command & Search Prompts
      case ':':
        e.preventDefault();
        openInputbar(':');
        break;
      case '/':
        e.preventDefault();
        openInputbar('/');
        break;

      // Search navigation
      case 'N':
        e.preventDefault();
        findNextSearch(true);
        break;

      // Help
      case 'h':
      case '?':
        e.preventDefault();
        toggleHelp();
        break;

      case 'Escape':
        closeHelp();
        if (state.mode === 'index') toggleIndexMode();
        break;
    }
  }

  // --- Attach Frame Events ---
  function setupIframeListeners() {
    try {
      const doc = readerFrame.contentDocument;
      const win = readerFrame.contentWindow;
      if (!doc || !win) return;

      // Attach unified keyboard listener inside iframe
      doc.addEventListener('keydown', handleKeyDown);

      // Track scroll progress
      win.addEventListener('scroll', updateScrollStatus);

      // Intercept anchor link clicks inside EPUB to keep in same reader
      doc.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
          const url = new URL(link.href, win.location.href);
          // If internal to book
          if (url.origin === window.location.origin && url.pathname.startsWith('/book/')) {
            const relPath = url.pathname.replace(/^\/book\//, '');
            // Find in spine
            const spineIdx = state.bookMeta.spine.findIndex((s) => s.href === relPath);
            if (spineIdx !== -1) {
              e.preventDefault();
              loadChapter(spineIdx, url.hash.replace(/^#/, ''));
            }
          }
        }
      });
    } catch (_) {}
  }

  // --- Initialize Application ---
  async function init() {
    window.addEventListener('keydown', handleKeyDown);
    inputbarInput.addEventListener('input', updateCompletion);

    try {
      const res = await fetch('/api/book');
      if (!res.ok) throw new Error('Falha ao obter metadados do livro');
      state.bookMeta = await res.json();

      document.title = `${state.bookMeta.title} - OxideReader`;
      state.tocItems = buildTocFlatList(state.bookMeta.toc);
      indexCount.textContent = `${state.tocItems.length} tópicos`;

      loadSavedState();

      readerFrame.addEventListener('load', () => {
        loadingIndicator.style.display = 'none';
        applyIframeStyles();
        setupIframeListeners();
        updateStatusbar();
      });

      // Load initial chapter
      loadChapter(state.currentSpineIndex);
    } catch (err) {
      console.error(err);
      loadingIndicator.textContent = `Erro ao carregar livro: ${err.message}`;
      showNotification(err.message, 'error', 6000);
    }
  }

  // Start
  init();
})();
