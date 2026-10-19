// "Quando" de um lembrete em português do dia a dia (e ISO, para agentes): "em 30 min", "em 2h", "em 1h30",
// "amanhã 9h", "hoje 18:30", "sexta 14h", "20/10 10:00", "18h" (hoje, ou amanhã se já passou),
// "2026-10-20 09:00". Dia sem hora = 9h. Também descreve um horário de volta ("amanhã 09:00").

const DEFAULT_HOUR = 9;
const WEEKDAYS = { domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6 };
const UNIT = { m: 60e3, min: 60e3, mins: 60e3, minuto: 60e3, minutos: 60e3, h: 3600e3, hr: 3600e3, hora: 3600e3, horas: 3600e3, d: 864e5, dia: 864e5, dias: 864e5 };

const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/**
 * "em 2h", "em 1h30", "30 min", "in 15m", "2 dias" → ms a partir de agora (ou null). Hora sozinha ("9h",
 * "18h") é horário, não duração: para horas a partir de agora, diga "em 2h".
 */
function relative(s) {
  const m = /^(em |daqui a |daqui |in )?\s*(\d+)\s*([a-z]+)(?:\s*e?\s*(\d+)\s*(?:m|min|mins|minutos?)?)?$/.exec(s);
  const [, prefix, n, unit, extraMin] = m || [];
  if (!m || !UNIT[unit]) return null;
  if (!prefix && UNIT[unit] === UNIT.h) return null; // "9h" = às 9h
  return Number(n) * UNIT[unit] + (extraMin ? Number(extraMin) * 60e3 : 0);
}

/** Hora no fim do texto: "9h", "9:30", "09h30", "às 18" → [h, min] ou null. */
function clock(s) {
  const m = /(?:^|\s)(?:as\s+|a\s+)?(\d{1,2})(?:(?:h|:)(\d{2})?)?h?$/.exec(s);
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2] || 0)];
  return h < 24 && min < 60 ? [h, min, m.index] : null;
}

const at = (base, h, min) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, min).getTime();
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** Data: hoje/amanhã/depois de amanhã, dia da semana (o próximo) ou dd/mm[/aaaa]. */
function day(word, now) {
  if (!word || word === 'hoje') return addDays(now, 0);
  if (word === 'amanha') return addDays(now, 1);
  if (word === 'depois de amanha') return addDays(now, 2);
  const name = word.replace(/-feira$/, '').replace(/^(?:na|no|nesta|neste|proxima|proximo)\s+/, '');
  if (name in WEEKDAYS) return addDays(now, ((WEEKDAYS[name] - now.getDay() + 7) % 7) || 7);
  const d = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(word);
  if (!d) return null;
  const year = d[3] ? (d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3])) : now.getFullYear();
  const date = new Date(year, Number(d[2]) - 1, Number(d[1]));
  return !d[3] && date < addDays(now, 0) ? new Date(year + 1, date.getMonth(), date.getDate()) : date;
}

/** Texto → instante (ms). Lança erro com exemplos quando não entende. */
export function parseWhen(text, now = new Date()) {
  const s = plain(text);
  if (!s) throw new Error('Diga quando: ex. "em 30 min", "amanhã 9h", "sexta 14h".');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = new Date(s.replace(' ', 'T')).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const rel = relative(s);
  if (rel != null) return now.getTime() + rel;
  const c = clock(s);
  const rest = (c ? s.slice(0, c[2]) : s).replace(/\s+(?:as|a)$/, '').trim();
  const date = day(rest, now);
  if (!date) throw new Error(`Não entendi "${text}". Exemplos: "em 30 min", "em 2h", "amanhã 9h", "sexta 14h", "20/10 10:00".`);
  const [h, min] = c || [DEFAULT_HOUR, 0];
  const t = at(date, h, min);
  // só a hora ("18h") que já passou hoje vale para amanhã
  return !rest && t <= now.getTime() ? at(addDays(now, 1), h, min) : t;
}

const two = (n) => String(n).padStart(2, '0');
const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Instante → "hoje 18:30", "amanhã 09:00", "sex 14:00", "20/10 10:00". */
export function describeWhen(t, now = new Date()) {
  const d = new Date(t);
  const hm = `${two(d.getHours())}:${two(d.getMinutes())}`;
  const diff = Math.round((addDays(d, 0) - addDays(now, 0)) / 864e5);
  if (diff === 0) return `hoje ${hm}`;
  if (diff === 1) return `amanhã ${hm}`;
  if (diff > 1 && diff < 7) return `${DAY_NAMES[d.getDay()]} ${hm}`;
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${hm}`;
}
