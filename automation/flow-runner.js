const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const selectors = require('./flow-selectors.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));
class FlowRunner {
  constructor({ appDir, emit }) {
    this.appDir = appDir; this.emit = emit; this.running = false; this.stopRequested = false;
    this.state = { running: 0, queued: 0, done: 0, errors: 0, current: '', profile: '' };
    this.settingsFile = path.join(appDir(), 'settings.json');
  }
  settings() {
    const defaults = { model: 'Veo 3.1', duration: '8s', ratio: '9:16', minCredits: 10, waitBetween: 2000, downloadRoot: path.join(this.appDir(), 'downloads') };
    if (!fs.existsSync(this.settingsFile)) return defaults;
    return { ...defaults, ...JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')) };
  }
  saveSettings(s) { fs.writeFileSync(this.settingsFile, JSON.stringify(s, null, 2)); return this.settings(); }
  status() { return this.state; }
  log(message, extra={}) { const row = { time: new Date().toISOString(), message, ...extra }; this.emit('log', row); const f = path.join(this.appDir(), 'logs', `${new Date().toISOString().slice(0,10)}.log`); fs.mkdirSync(path.dirname(f), {recursive:true}); fs.appendFileSync(f, JSON.stringify(row)+'\n'); }
  async find(page, list, timeout=30000) {
    const end = Date.now()+timeout;
    while (Date.now()<end && !this.stopRequested) {
      for (const s of list) { try { const loc=page.locator(s).first(); if (await loc.count() && await loc.isVisible()) return loc; } catch {} }
      await sleep(400);
    }
    throw new Error('Không tìm thấy element: '+list.join(' | '));
  }
  async setPrompt(page, prompt) {
    const box = await this.find(page, selectors.prompt);
    await box.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
    await box.fill(prompt);
    await box.evaluate(el => { el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
  }
  async clickVideo(page) { try { const x=await this.find(page, selectors.video, 8000); await x.click(); } catch {} }
  async chooseModel(page, model) {
    if (!model) return;
    try { const menu=await this.find(page, selectors.modelMenu, 8000); await menu.click();
      const option = model.includes('Veo') ? selectors.modelOptionVeo31 : [`[role="menuitem"]:has-text("${model}")`, `[role="option"]:has-text("${model}")`, `text=${model}`];
      const x=await this.find(page, option, 8000); await x.click();
    } catch (e) { this.log('Không chọn được model, giữ model hiện tại', {error:e.message}); }
  }
  async generate(page) { const b=await this.find(page, selectors.generate); await b.click(); }
  async waitAndDownload(page, downloadDir) {
    const start=Date.now();
    while (Date.now()-start < 15*60*1000 && !this.stopRequested) {
      const videos = page.locator('video');
      if (await videos.count()) {
        for (let i=0;i<await videos.count();i++) { try { const v=videos.nth(i); const src=await v.getAttribute('src'); if(src && !src.startsWith('blob:')) {} } catch {} }
      }
      for (const s of selectors.download) {
        try { const b=page.locator(s).last(); if(await b.count() && await b.isVisible()) {
          fs.mkdirSync(downloadDir,{recursive:true});
          const dl = await page.waitForEvent('download', async()=>{ await b.click(); }, {timeout:10000});
          const suggested=dl.suggestedFilename() || `flow-${Date.now()}.mp4`; const dest=path.join(downloadDir,suggested); await dl.saveAs(dest); return dest;
        }} catch {}
      }
      await sleep(1500);
    }
    throw new Error('Hết thời gian chờ video hoàn thành.');
  }
  async connect(port) { return chromium.connectOverCDP(`http://127.0.0.1:${port}`); }
  async runQueue({ prompts, profiles, settings }) {
    if(this.running) return {ok:false,message:'Queue đang chạy'};
    this.running=true; this.stopRequested=false; this.state={running:0,queued:prompts.length,done:0,errors:0,current:'',profile:''};
    const cfg={...this.settings(),...(settings||{})};
    try {
      for (let i=0;i<prompts.length;i++) {
        if(this.stopRequested) break;
        const prompt=prompts[i]; this.state.current=prompt; this.state.queued=prompts.length-i-1;
        let success=false;
        for(const p of profiles.filter(x=>x.enabled)) {
          if(this.stopRequested) break;
          this.state.profile=p.name; this.emit('state',this.state); this.log('Bắt đầu prompt',{profile:p.name,prompt});
          let browser;
          try {
            browser=await this.connect(9220+Number(p.id)); const pages=browser.contexts().flatMap(c=>c.pages()); const page=pages.find(pg=>pg.url().includes('flow.google.com')) || pages[0];
            if(!page) throw new Error('Không có tab Flow trong profile. Hãy mở profile bằng Tài khoản Flow trước.');
            await page.bringToFront(); await page.goto('https://flow.google.com/',{waitUntil:'domcontentloaded',timeout:60000});
            await this.setPrompt(page,prompt); await this.clickVideo(page); await this.chooseModel(page,cfg.model); await this.generate(page);
            const out=path.join(cfg.downloadRoot, p.id); const file=await this.waitAndDownload(page,out);
            this.state.done++; this.log('Hoàn thành',{profile:p.name,prompt,file}); this.emit('state',this.state); success=true; await browser.close(); break;
          } catch(e) { this.state.errors++; this.log('Profile lỗi hoặc không khả dụng',{profile:p.name,prompt,error:e.message}); this.emit('state',this.state); try{await browser?.close();}catch{} }
        }
        if(!success) this.log('Không còn profile khả dụng cho prompt',{prompt});
        await sleep(Number(cfg.waitBetween)||0);
      }
    } finally { this.running=false; this.state.running=0; this.emit('state',this.state); }
    return {ok:true,state:this.state};
  }
  async stop(){this.stopRequested=true; return {ok:true};}
}
module.exports={FlowRunner};
