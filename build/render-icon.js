// Gera build/icon.png (512×512, fundo transparente) a partir de build/icon.svg.
// uso: npx electron build/render-icon.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const SIZE = 512;
const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  fs.writeFileSync(path.join(__dirname, 'icon.png'), image.resize({ width: SIZE, height: SIZE }).toPNG());
  app.quit();
});
