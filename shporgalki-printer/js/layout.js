// layout.js
// Расчёт раскладки билетов на лист A4

const A4 = {
  width: 210,  // mm
  height: 297 // mm
};

const GRID_PRESETS = {
  2:  { cols: 1, rows: 2 },
  4:  { cols: 2, rows: 2 },
  6:  { cols: 2, rows: 3 },
  8:  { cols: 2, rows: 4 },
  9:  { cols: 3, rows: 3 },
  12: { cols: 3, rows: 4 },
  16: { cols: 4, rows: 4 }
};

/**
 * Возвращает количество колонок и строк для заданного числа билетов
 * @param {number} count
 * @returns {{cols: number, rows: number}}
 */
export function getGrid(count) {
  if (GRID_PRESETS[count]) {
    return GRID_PRESETS[count];
  }
  // fallback — подбираем близкую сетку
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

/**
 * Создаёт DOM-элементы листов A4 с билетами
 * @param {Array} tickets
 * @param {Object} options
 * @returns {HTMLElement}
 */
export function renderLayout(tickets, options) {
  const {
    ticketsPerPage = 4,
    orientation = 'portrait',
    margins = { top: 10, right: 10, bottom: 10, left: 10 },
    gap = 5,
    fontSize = 10,
    showNumbers = true,
    cutMarks = false,
    mode = 'page'
  } = options;

  const { cols, rows } = getGrid(ticketsPerPage);
  const ticketsPerSheet = cols * rows;
  const totalSheets = Math.ceil(tickets.length / ticketsPerSheet);

  const container = document.createElement('div');
  container.className = 'preview-pages';

  const sheetWidth = orientation === 'landscape' ? A4.height : A4.width;
  const sheetHeight = orientation === 'landscape' ? A4.width : A4.height;

  const usableWidth = sheetWidth - margins.left - margins.right;
  const usableHeight = sheetHeight - margins.top - margins.bottom;

  const cellWidth = (usableWidth - gap * (cols - 1)) / cols;
  const cellHeight = (usableHeight - gap * (rows - 1)) / rows;

  for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex++) {
    const sheet = document.createElement('div');
    sheet.className = `preview-page print-sheet ${orientation === 'landscape' ? 'landscape' : ''}`;
    sheet.style.setProperty('--cols', cols);
    sheet.style.setProperty('--rows', rows);
    sheet.style.setProperty('--gap', `${gap}mm`);
    sheet.style.setProperty('--margin-top', `${margins.top}mm`);
    sheet.style.setProperty('--margin-right', `${margins.right}mm`);
    sheet.style.setProperty('--margin-bottom', `${margins.bottom}mm`);
    sheet.style.setProperty('--margin-left', `${margins.left}mm`);
    sheet.style.setProperty('--ticket-font-size', `${fontSize}pt`);
    sheet.style.width = `${sheetWidth}mm`;
    sheet.style.height = `${sheetHeight}mm`;

    const label = document.createElement('div');
    label.className = 'preview-page__label';
    label.textContent = `Лист ${sheetIndex + 1} из ${totalSheets}`;
    sheet.appendChild(label);

    const start = sheetIndex * ticketsPerSheet;
    const end = Math.min(start + ticketsPerSheet, tickets.length);

    for (let i = start; i < end; i++) {
      const ticket = tickets[i];
      const cell = document.createElement('div');
      cell.className = 'print-ticket';
      cell.style.width = `${cellWidth}mm`;
      cell.style.height = `${cellHeight}mm`;

      if (showNumbers) {
        const num = document.createElement('div');
        num.className = 'print-ticket__number';
        num.textContent = `#${ticket.page}`;
        cell.appendChild(num);
      }

      const content = document.createElement('div');
      content.className = mode === 'page' ? 'print-ticket__page' : 'print-ticket__text';

      if (mode === 'page' && ticket.canvas) {
        const img = document.createElement('img');
        img.src = ticket.canvas.toDataURL('image/png');
        img.alt = `Билет ${ticket.page}`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        content.appendChild(img);
      } else {
        content.textContent = ticket.text || '(пусто)';
      }

      cell.appendChild(content);
      sheet.appendChild(cell);
    }

    // Добавляем пустые ячейки для завершения сетки
    const emptyCells = ticketsPerSheet - (end - start);
    for (let i = 0; i < emptyCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'print-ticket';
      cell.style.width = `${cellWidth}mm`;
      cell.style.height = `${cellHeight}mm`;
      cell.style.opacity = '0';
      sheet.appendChild(cell);
    }

    if (cutMarks && sheetIndex === 0) {
      addCutMarks(sheet, cols, rows, cellWidth, cellHeight, gap, margins);
    }

    container.appendChild(sheet);
  }

  return container;
}

function addCutMarks(sheet, cols, rows, cellWidth, cellHeight, gap, margins) {
  // Вертикальные линии между колонками
  for (let c = 1; c < cols; c++) {
    const x = margins.left + c * cellWidth + (c - 1) * gap + gap / 2;
    const line = document.createElement('div');
    line.className = 'cut-mark vertical';
    line.style.left = `${x}mm`;
    line.style.top = '0';
    line.style.bottom = '0';
    sheet.appendChild(line);
  }

  // Горизонтальные линии между строками
  for (let r = 1; r < rows; r++) {
    const y = margins.top + r * cellHeight + (r - 1) * gap + gap / 2;
    const line = document.createElement('div');
    line.className = 'cut-mark horizontal';
    line.style.top = `${y}mm`;
    line.style.left = '0';
    line.style.right = '0';
    sheet.appendChild(line);
  }
}

/**
 * Возвращает информацию о раскладке
 */
export function getLayoutInfo(tickets, options) {
  const { cols, rows } = getGrid(options.ticketsPerPage || 4);
  const perSheet = cols * rows;
  return {
    totalTickets: tickets.length,
    ticketsPerSheet: perSheet,
    totalSheets: Math.ceil(tickets.length / perSheet),
    grid: { cols, rows }
  };
}
