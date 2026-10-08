const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const messages = document.querySelector('#messages');
const sendButton = document.querySelector('#send-button');
const newChatButton = document.querySelector('#new-chat');
const SESSION_KEY = 'simple-chat-session';
let sessionId = sessionStorage.getItem(SESSION_KEY) || crypto.randomUUID();
sessionStorage.setItem(SESSION_KEY, sessionId);
const HISTORY_KEY = `simple-chat-history:${sessionId}`;

function addMessage(role, text, extraClass = '', persist = true) {
  document.querySelector('#welcome')?.remove();
  const row = document.createElement('div');
  row.className = `message-row ${role} ${extraClass}`;
  if (role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = '✳';
    row.append(avatar);
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.append(bubble);
  messages.append(row);
  if (persist && !extraClass) {
    const history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
    history.push({ role, text });
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
  messages.scrollTop = messages.scrollHeight;
  return row;
}

for (const item of JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]')) {
  addMessage(item.role, item.text, '', false);
}

function setBusy(busy) {
  sendButton.disabled = busy;
  input.disabled = busy;
}

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || sendButton.disabled) return;
  addMessage('user', trimmed);
  input.value = '';
  input.style.height = 'auto';
  setBusy(true);
  const typing = addMessage('assistant', '답변을 작성하고 있어요…', 'typing');
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: trimmed })
    });
    const result = await response.json();
    typing.remove();
    if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
    addMessage('assistant', result.reply);
  } catch (error) {
    typing.remove();
    addMessage('assistant', error.message || '연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    setBusy(false);
    input.focus();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => sendMessage(button.dataset.prompt));
});

newChatButton.addEventListener('click', async () => {
  await fetch(`/api/chat/${sessionId}`, { method: 'DELETE' }).catch(() => {});
  sessionStorage.removeItem(HISTORY_KEY);
  sessionId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, sessionId);
  // Store the new transcript under the new session identifier.
  window.location.reload();
  return;
});
