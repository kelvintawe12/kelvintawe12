#!/usr/bin/env node
import fs from 'fs/promises';

const repo = process.env.GITHUB_REPOSITORY || '';
const owner = process.env.OWNER || repo.split('/')[0];
const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

async function fetchRepos() {
  const url = `https://api.github.com/users/${owner}/repos?per_page=100`;
  const res = await fetch(url, { headers: { Authorization: `token ${token}`, 'User-Agent': owner } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${text}`);
  }
  return res.json();
}

function makeMarkdown(repos) {
  const top = repos.slice(0, 6);
  let md = '<!--PINNED_REPOS-->\n<div align="center">\n<table>\n<tr>\n';
  for (const r of top) {
    const desc = r.description ? r.description.replace(/\n/g, ' ') : '';
    md += `<td valign="top" width="33%"><a href="${r.html_url}"><strong>${r.name}</strong></a><p>${desc}</p>⭐ ${r.stargazers_count}</td>\n`;
  }
  md += '</tr>\n</table>\n</div>\n<!--END_PINNED_REPOS-->\n';
  return md;
}

try {
  const repos = await fetchRepos();
  if (!Array.isArray(repos)) throw new Error('Unexpected response from GitHub API');

  repos.sort((a, b) => {
    const stars = b.stargazers_count - a.stargazers_count;
    if (stars !== 0) return stars;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  const md = makeMarkdown(repos);
  const readmePath = 'README.md';
  const readme = await fs.readFile(readmePath, 'utf8');

  let newReadme;
  if (/<!--PINNED_REPOS-->[\s\S]*?<!--END_PINNED_REPOS-->/.test(readme)) {
    newReadme = readme.replace(/<!--PINNED_REPOS-->[\s\S]*?<!--END_PINNED_REPOS-->/, md);
  } else {
    const marker = '\n**Featured Projects**\n\n';
    const idx = readme.indexOf('**Featured Projects**');
    if (idx !== -1) {
      // insert after the header line
      const after = readme.indexOf('\n', idx);
      const insertAt = after + 1;
      newReadme = readme.slice(0, insertAt) + md + readme.slice(insertAt);
    } else {
      newReadme = readme + '\n' + md;
    }
  }

  await fs.writeFile(readmePath, newReadme, 'utf8');
  console.log('README updated with pinned repos');
} catch (err) {
  console.error(err);
  process.exit(1);
}
