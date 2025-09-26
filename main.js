
(function() {
  const tools = document.querySelectorAll('.tool');
  tools.forEach(btn => btn.addEventListener('click', () => {
    tools.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }));
  document.querySelectorAll('[data-action="toggle-message-box"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const mb = document.querySelector('.hc-message-box');
      if (!mb) return;
      mb.hidden = !mb.hidden;
      document.getElementById('mb-input')?.focus();
    });
  });
  document.querySelectorAll('[data-action="toggle-tools"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const toolsPane = document.querySelector('.hc-tools');
      toolsPane.style.display = (toolsPane.style.display === 'none') ? 'block' : 'none';
      document.querySelector('.hc-main').style.gridTemplateColumns = (toolsPane.style.display === 'none') ? '0 1fr' : '160px 1fr';
    });
  });
  const mbInput = document.getElementById('mb-input');
  const mbOutput = document.getElementById('mb-output');
  if (mbInput && mbOutput) {
    mbInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // A tiny demo interpreter: echoes the line and fakes a result value.
        const line = mbInput.value.trim();
        if (!line) return;
        if (/^beep/i.test(line)) {
          mbOutput.value = '🔔 (beep)';
        } else if (/^go\s+next/i.test(line)) {
          mbOutput.value = '→ would go to next card';
        } else if (/^answer/i.test(line)) {
          mbOutput.value = 'would display an answer dialog';
        } else {
          mbOutput.value = 'sent line: ' + line;
        }
        mbInput.value = '';
      }
    });
  }
})();
