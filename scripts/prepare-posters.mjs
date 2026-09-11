#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import '../docs/assets/js/config.js';

const docsRoot = fileURLToPath(new URL('../docs/', import.meta.url));
const ffmpeg = process.env.FFMPEG?.trim() || 'ffmpeg';
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'roboreact-posters-'));
const videos = globalThis.ROBOREACT_CONFIG.videos;

try {
  for (const video of videos) {
    const source = path.resolve(docsRoot, video.src);
    const poster = path.resolve(docsRoot, video.poster);
    const temporaryPoster = path.join(temporaryDirectory, path.basename(poster));
    const result = spawnSync(ffmpeg, [
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
      '-i', source,
      '-map', '0:v:0', '-frames:v', '1', '-an', '-sn', '-dn',
      // Convert the video's color matrix to RGB before WebP encoding.
      '-vf', 'format=bgra',
      '-c:v', 'libwebp', '-quality', '84', '-compression_level', '6',
      temporaryPoster,
    ], { encoding: 'utf8', timeout: 30_000 });

    if (result.error || result.status !== 0) {
      throw new Error(`${video.id}: ${result.error?.message || result.stderr.trim()}`);
    }
    if (!fs.existsSync(temporaryPoster) || fs.statSync(temporaryPoster).size === 0) {
      throw new Error(`${video.id}: FFmpeg did not produce a first-frame poster`);
    }
  }

  // Finish decoding every video before replacing any existing posters.
  for (const video of videos) {
    const poster = path.resolve(docsRoot, video.poster);
    fs.mkdirSync(path.dirname(poster), { recursive: true });
    fs.copyFileSync(path.join(temporaryDirectory, path.basename(poster)), poster);
  }
  console.log(`Prepared ${videos.length} posters from the first frames of the configured public videos.`);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
