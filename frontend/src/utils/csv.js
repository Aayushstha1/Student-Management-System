export const parseCsv = (text) => {
  if (!text) return { headers: [], rows: [], records: [] };
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const lines = rawLines.filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [], records: [] };

  const parseLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    values.push(current);
    return values.map((value) => value.trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseLine);
  const records = rows.map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').trim();
    });
    return obj;
  });

  return { headers, rows, records };
};

export const csvValue = (value) => (typeof value === 'string' ? value.trim() : value);

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const buildCsv = (headers, rows = []) => {
  const lines = [];
  lines.push(headers.map(escapeCsvValue).join(','));
  rows.forEach((row) => {
    if (Array.isArray(row)) {
      lines.push(row.map(escapeCsvValue).join(','));
      return;
    }
    const line = headers.map((header) => escapeCsvValue(row?.[header] ?? '')).join(',');
    lines.push(line);
  });
  return lines.join('\n');
};

export const downloadCsvTemplate = (filename, headers, rows = []) => {
  const content = buildCsv(headers, rows);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const normalizeCsvRecords = (records) => records.map((row) => {
  const normalized = {};
  Object.keys(row || {}).forEach((key) => {
    normalized[String(key).trim().toLowerCase()] = row[key];
  });
  return normalized;
});
