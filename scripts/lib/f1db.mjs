// F1DB (https://github.com/f1db/f1db, CC BY 4.0): 1950'den bugune tum sonuclar.
// Her yaristan birkac saat sonra yeni surum cikar; surum etiketi degismediyse islenmis onbellek kullanilir.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { http, log, sha256File } from './util.mjs';

export async function latestF1dbRelease({ token } = {}) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const rel = await http('https://api.github.com/repos/f1db/f1db/releases/latest', { headers, timeout: 20000, retries: 2 });
  const asset = rel.assets.find((a) => a.name === 'f1db-json-splitted.tgz');
  if (!asset) throw new Error('F1DB: f1db-json-splitted.tgz bulunamadi');
  return { tag: rel.tag_name, published: rel.published_at, asset };
}

// Ham tablolari indirip acar; donus: tablo klasoru
export async function downloadF1db(rel, cacheDir) {
  const dir = path.join(cacheDir, 'f1db-raw', rel.tag);
  const dataDir = path.join(dir, 'package', 'data');
  if (fs.existsSync(path.join(dataDir, 'f1db-races.json'))) return dataDir;
  log('F1DB indiriliyor:', rel.tag, `${(rel.asset.size / 1e6).toFixed(1)} MB`);
  const buf = await http(rel.asset.browser_download_url, { as: 'buffer', timeout: 180000, retries: 2 });
  fs.rmSync(path.join(cacheDir, 'f1db-raw'), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const tgz = path.join(dir, 'f1db.tgz');
  fs.writeFileSync(tgz, buf);
  if (rel.asset.digest && rel.asset.digest.startsWith('sha256:') && sha256File(tgz) !== rel.asset.digest.slice(7)) throw new Error('F1DB: sha256 uyusmuyor');
  // Windows'ta "C:\..." yolunu tar uzak sunucu sanmasin diye goreli yol + cwd
  execFileSync('tar', ['-xzf', 'f1db.tgz'], { cwd: dir, stdio: 'ignore' });
  fs.unlinkSync(tgz);
  return dataDir;
}

export function dropRaw(cacheDir) {
  fs.rmSync(path.join(cacheDir, 'f1db-raw'), { recursive: true, force: true });
}

export function tableLoader(dataDir) {
  const cache = new Map();
  return (name) => {
    if (!cache.has(name)) {
      const file = path.join(dataDir, `f1db-${name}.json`);
      cache.set(name, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
    }
    return cache.get(name);
  };
}
