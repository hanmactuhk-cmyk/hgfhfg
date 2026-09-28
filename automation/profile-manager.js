const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function chromeCandidates() {
  if (process.platform !== 'win32') return [];
  return [
    path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
  ];
}
function findChrome() {
  const hit = chromeCandidates().find(p => p && fs.existsSync(p));
  if (!hit) throw new Error('Không tìm thấy Google Chrome. Hãy cài Chrome trước.');
  return hit;
}

class ProfileManager {
  constructor(root) {
    this.root = root;
    this.file = path.join(root, 'profiles.json');
    this.profilesDir = path.join(root, 'profiles');
    fs.mkdirSync(this.profilesDir, { recursive: true });
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, '[]');
    this.children = new Map();
  }
  read() { return JSON.parse(fs.readFileSync(this.file, 'utf8')); }
  write(x) { fs.writeFileSync(this.file, JSON.stringify(x, null, 2)); }
  list() { return this.read(); }
  add(name) {
    const arr = this.read();
    const id = String(arr.length + 1).padStart(2, '0');
    const profile = { id, name: name || `Gmail ${id}`, path: path.join(this.profilesDir, `profile-${id}`), enabled: true, status: 'CHƯA ĐĂNG NHẬP', credits: null };
    fs.mkdirSync(profile.path, { recursive: true }); arr.push(profile); this.write(arr); return profile;
  }
  remove(id) {
    const arr = this.read().filter(p => p.id !== id); this.write(arr);
  }
  launch(profile, port) {
    const chrome = findChrome();
    const child = spawn(chrome, [`--user-data-dir=${profile.path}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', 'https://flow.google.com/'], { detached: true, stdio: 'ignore' });
    child.unref(); this.children.set(profile.id, { child, port });
    return port;
  }
  openForLogin(id) {
    const p = this.read().find(x => x.id === id); if (!p) throw new Error('Không tìm thấy profile');
    const port = 9220 + Number(id);
    this.launch(p, port); return { ...p, port };
  }
  openForAutomation(id) { return this.openForLogin(id); }
  async stop(id) {
    const item = this.children.get(id); if (item?.child?.pid) { try { process.kill(item.child.pid); } catch {} }
    this.children.delete(id);
  }
}
module.exports = { ProfileManager };
