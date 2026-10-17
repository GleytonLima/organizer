const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const userFile = (name) => path.join(app.getPath('userData'), name);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  const json = JSON.stringify(data, null, 2);
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, file);
  } catch {
    // rename pode falhar no Windows se o arquivo estiver bloqueado (antivírus, indexador)
    fs.writeFileSync(file, json);
  }
}

module.exports = { userFile, readJson, writeJsonAtomic };
