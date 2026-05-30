(() => {
  const root = document.querySelector('[data-comments]');
  if (!root) return;

  const slug = root.dataset.comments;
  const listEl = root.querySelector('.comments-list');
  const formEl = root.querySelector('.comments-form');
  const statusEl = root.querySelector('.comments-status');
  const countEl = root.querySelector('.comments-count');
  const submitBtn = formEl?.querySelector('button[type="submit"]');

  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const setStatus = (msg, kind) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.remove('is-success', 'is-error');
    if (kind) statusEl.classList.add(`is-${kind}`);
  };

  const setCount = (n) => {
    if (countEl) countEl.textContent = String(n);
  };

  const renderEmpty = () => {
    listEl.innerHTML =
      '<li class="comment-empty">No comments yet — start the conversation.</li>';
    setCount(0);
  };

  const render = (comments) => {
    if (!comments.length) return renderEmpty();
    setCount(comments.length);
    listEl.innerHTML = comments
      .map(
        (c) => `
        <li class="comment">
          <div class="comment-head">
            <span class="comment-name">${escape(c.name)}</span>
            <time class="comment-date" datetime="${escape(c.createdAt)}">${fmtDate(c.createdAt)}</time>
          </div>
          <p class="comment-body">${escape(c.message).replace(/\n/g, '<br />')}</p>
        </li>`
      )
      .join('');
  };

  const load = async () => {
    listEl.innerHTML = '<li class="comment-empty">Loading…</li>';
    try {
      const res = await fetch(`/api/comments?post=${encodeURIComponent(slug)}`, {
        headers: { accept: 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data.comments || []);
    } catch (err) {
      listEl.innerHTML =
        '<li class="comment-empty">Couldn’t load comments. Try refreshing.</li>';
      setCount(0);
    }
  };

  formEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', null);

    const name = formEl.name.value.trim();
    const message = formEl.message.value.trim();
    const website = formEl.website?.value || '';

    if (!name || !message) {
      setStatus('Please include both your name and a comment.', 'error');
      return;
    }

    formEl.classList.add('is-submitting');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch(`/api/comments?post=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, message, website })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        formEl.reset();
        setStatus('Thanks — comment posted.', 'success');
        load();
      } else {
        setStatus(data.error || 'Something went wrong. Try again.', 'error');
      }
    } catch (err) {
      setStatus('Network error — please try again.', 'error');
    } finally {
      formEl.classList.remove('is-submitting');
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  load();
})();
