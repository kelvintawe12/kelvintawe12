#!/usr/bin/env node
import fs from 'fs/promises';

const eventPath = process.env.GITHUB_EVENT_PATH;
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || '';
const [owner, repoName] = repo.split('/');

if (!eventPath || !token) {
  console.error('GITHUB_EVENT_PATH and GITHUB_TOKEN are required');
  process.exit(1);
}

async function addLabels(number, labels) {
  if (!labels.length) return;
  const url = `https://api.github.com/repos/${owner}/${repoName}/issues/${number}/labels`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': owner },
    body: JSON.stringify({ labels }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Failed to add labels:', res.status, text);
  } else {
    console.log('Labels added:', labels);
  }
}

async function main() {
  const raw = await fs.readFile(eventPath, 'utf8');
  const payload = JSON.parse(raw);

  let title = '';
  let body = '';
  let number = null;
  let existingLabels = [];

  if (payload.issue) {
    title = payload.issue.title || '';
    body = payload.issue.body || '';
    number = payload.issue.number;
    existingLabels = (payload.issue.labels || []).map(l => (typeof l === 'string' ? l : l.name));
  } else if (payload.pull_request) {
    title = payload.pull_request.title || '';
    body = payload.pull_request.body || '';
    number = payload.pull_request.number;
    existingLabels = (payload.pull_request.labels || []).map(l => (typeof l === 'string' ? l : l.name));
  } else {
    console.log('No issue or pull_request in event payload — skipping');
    return;
  }

  const text = (title + '\n' + body).toLowerCase();
  const mapping = [
    { label: 'bug', rx: /\b(bug|error|fail|crash|exception)\b/ },
    { label: 'enhancement', rx: /\b(feature|enhanc|proposal|request)\b/ },
    { label: 'documentation', rx: /\b(doc|docs|readme|documentation)\b/ },
    { label: 'good first issue', rx: /\b(good first issue|first-timer|beginner)\b/ },
    { label: 'help wanted', rx: /\b(help|assist|support|question)\b/ },
  ];

  const toAdd = [];
  for (const m of mapping) {
    if (m.rx.test(text) && !existingLabels.includes(m.label)) toAdd.push(m.label);
  }

  if (toAdd.length) await addLabels(number, toAdd);
  else console.log('No labels matched');
}

main().catch(err => { console.error(err); process.exit(1); });
