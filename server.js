import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import OpenAI from 'openai';

const app = express();
const port = Number(process.env.PORT) || 3000;
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const conversations = new Map();
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4000;

app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(rootDir, 'public')));

function getConversation(sessionId) {
  if (typeof sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
    return null;
  }
  if (!conversations.has(sessionId)) conversations.set(sessionId, []);
  return conversations.get(sessionId);
}

app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  const history = getConversation(sessionId);
  if (!history) return res.status(400).json({ error: '대화 세션이 올바르지 않습니다.' });
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '메시지를 입력해 주세요.' });
  }
  const userText = message.trim();
  if (userText.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `메시지는 ${MAX_MESSAGE_LENGTH}자 이내로 입력해 주세요.` });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: '서버에 OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해 주세요.' });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '말투 규칙은 반드시 지켜야 해. 모든 답변은 친근하고 다정한 한국어 반말로만 작성해. 기본적으로 해체를 사용하고, 존댓말 어미(예: -요, -습니다, -세요)를 쓰지 마. 사용자가 "안녕"처럼 인사하면 "안녕!"처럼 반말로 답해. 사용자가 명시적으로 존댓말을 요청한 경우에만 존댓말로 바꿔. 이 말투 규칙을 대화가 길어져도 계속 유지해. 답변은 정확하고 솔직하게 하고, 이전 대화의 문맥도 반영해.' },
        ...history,
        { role: 'user', content: userText }
      ]
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error('모델이 빈 답변을 반환했습니다.');

    history.push({ role: 'user', content: userText }, { role: 'assistant', content: reply });
    if (history.length > MAX_MESSAGES) history.splice(0, history.length - MAX_MESSAGES);
    res.json({ reply });
  } catch (error) {
    console.error('Chat request failed:', error.message);
    res.status(502).json({ error: '답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

app.delete('/api/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) {
    return res.status(400).json({ error: '대화 세션이 올바르지 않습니다.' });
  }
  conversations.delete(sessionId);
  res.status(204).end();
});

app.listen(port, () => {
  console.log(`Chatbot is running at http://localhost:${port}`);
});
