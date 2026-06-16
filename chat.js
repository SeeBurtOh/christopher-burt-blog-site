(() => {
  const panel = document.getElementById('twin-chat');
  if (!panel) return;

  const messagesEl = document.getElementById('twin-messages');
  const form = document.getElementById('twin-form');
  const input = document.getElementById('twin-input');
  const status = document.getElementById('twin-status');
  const sendBtn = form?.querySelector('button[type="submit"]');

  /** @type {{role: 'user'|'assistant', content: string}[]} */
  let history = [];

  const setStatus = (msg, kind) => {
    if (!status) return;
    status.textContent = msg || '';
    status.classList.remove('is-success', 'is-error');
    if (kind) status.classList.add(`is-${kind}`);
  };

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const appendMessage = (role, content) => {
    const row = document.createElement('div');
    row.className = `twin-msg twin-msg--${role}`;
    const label = role === 'user' ? 'You' : 'Christopher';
    row.innerHTML = `
      <div class="twin-msg-label">${label}</div>
      <div class="twin-msg-body">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
    `;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', null);

    const message = input.value.trim();
    if (!message) return;

    if (form._gotcha?.value) return;

    appendMessage('user', message);
    history.push({ role: 'user', content: message });
    input.value = '';
    input.disabled = true;
    sendBtn?.classList.add('is-submitting');
    sendBtn?.setAttribute('disabled', 'true');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: history.slice(0, -1) }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(data.error || 'Something went wrong.', 'error');
        return;
      }

      const reply = data.reply || '';
      appendMessage('assistant', reply);
      history.push({ role: 'assistant', content: reply });
      if (history.length > 12) history = history.slice(-12);
    } catch {
      setStatus('Network error — please try again.', 'error');
    } finally {
      input.disabled = false;
      sendBtn?.classList.remove('is-submitting');
      sendBtn?.removeAttribute('disabled');
      input.focus();
    }
  });
})();
