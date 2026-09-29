(() => {
  'use strict';

  const open = articleId => window.KathleenHelp?.open?.(articleId);

  function addInlineHelp(selector, articleId, label) {
    const anchor = document.querySelector(selector);
    if (!anchor || anchor.querySelector(':scope > .k-inline-help')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'k-inline-help';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.textContent = '?';
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      open(articleId);
    };
    anchor.appendChild(button);
  }

  function addProblemHelp() {
    const failedImport = document.querySelector('#progressPanel.failed');
    if (failedImport && !failedImport.querySelector('[data-problem-help]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button soft k-problem-help';
      button.dataset.problemHelp = 'pdf-troubleshooting';
      button.textContent = 'Problem lösen';
      button.onclick = () => open('pdf-troubleshooting');
      failedImport.appendChild(button);
    }

    const extractorPhase = document.querySelector('#phase');
    if (extractorPhase?.textContent?.trim() === 'Fehler' && !document.querySelector('[data-problem-help="extractor"]')) {
      const actions = document.querySelector('.controls .actions');
      if (!actions) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button soft k-problem-help';
      button.dataset.problemHelp = 'extractor';
      button.textContent = 'Problem lösen';
      button.onclick = () => open('pdf-troubleshooting');
      actions.appendChild(button);
    }
  }

  function connectExistingHelp() {
    const extractorHelp = document.querySelector('#help');
    if (extractorHelp && !extractorHelp.dataset.centralHelp) {
      extractorHelp.dataset.centralHelp = 'true';
      extractorHelp.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        open('english-extractor');
      }, true);
    }
  }

  function enhance() {
    const helpPanel = document.querySelector('#kHelpCenter');
    if (helpPanel) {
      const open = helpPanel.classList.contains('open');
      const wasInert = helpPanel.inert;
      helpPanel.setAttribute('aria-modal', 'true');
      helpPanel.setAttribute('aria-hidden', String(!open));
      helpPanel.inert = !open;
      if (open && wasInert) requestAnimationFrame(() => helpPanel.querySelector('.k-help-close')?.focus());
    }
    addInlineHelp('#afbControls', 'assessment-afb', 'Hilfe zu den Anforderungsbereichen');
    addInlineHelp('#filters', 'extractor-confidence', 'Hilfe zur Qualität und Prüfung');
    addInlineHelp('#reviewPanel .section-heading', 'material-import', 'Hilfe zur Materialprüfung');
    connectExistingHelp();
    addProblemHelp();
  }

  function init() {
    enhance();
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.querySelector('#kHelpCenter.open')) window.KathleenHelp?.close?.();
    });
    new MutationObserver(enhance).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
