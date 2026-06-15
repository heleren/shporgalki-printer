// layout.js
// Расчёт раскладки билетов на лист A4

(function (global) {
  'use strict';

  var A4 = {
    width: 210,
    height: 297
  };

  var GRID_PRESETS = {
    2: { cols: 1, rows: 2 },
    4: { cols: 2, rows: 2 },
    6: { cols: 2, rows: 3 },
    8: { cols: 2, rows: 4 },
    9: { cols: 3, rows: 3 },
    12: { cols: 3, rows: 4 },
    16: { cols: 4, rows: 4 }
  };

  function getGrid(count) {
    if (GRID_PRESETS[count]) {
      return GRID_PRESETS[count];
    }
    var cols = Math.ceil(Math.sqrt(count));
    var rows = Math.ceil(count / cols);
    return { cols: cols, rows: rows };
  }

  function estimateCharsPerCell(cellWidth, cellHeight, fontSizePt) {
    var fontSizeMm = fontSizePt * 0.3528;
    var charWidth = fontSizeMm * 0.6;
    var lineHeight = fontSizeMm * 1.5;
    var charsPerLine = Math.max(1, Math.floor((cellWidth - 4) / charWidth));
    var linesPerCell = Math.max(1, Math.floor((cellHeight - 4) / lineHeight));
    return charsPerLine * linesPerCell;
  }

  function splitTextByChunks(text, maxLen) {
    if (!text || text.length <= maxLen) {
      return text ? [text] : [];
    }
    var chunks = [];
    var parts = text.split(/(?<=[.!?\n])\s+/);
    var current = '';
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;
      if (current.length + part.length + 1 > maxLen && current.length > 0) {
        chunks.push(current.trim());
        current = part;
      } else {
        current = current ? current + ' ' + part : part;
      }
    }
    if (current) {
      chunks.push(current.trim());
    }
    // Если не получилось разбить (например, нет точек), режем по словам
    if (chunks.length === 1 && chunks[0].length > maxLen) {
      chunks = [];
      var words = text.split(/\s+/);
      current = '';
      for (var w = 0; w < words.length; w++) {
        var word = words[w];
        if (current.length + word.length + 1 > maxLen && current.length > 0) {
          chunks.push(current.trim());
          current = word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current) chunks.push(current.trim());
    }
    return chunks.length ? chunks : [text];
  }

  function expandTextTickets(tickets, ticketsPerPage, mode, cellWidth, cellHeight, fontSize) {
    if (mode !== 'text') return tickets;
    var maxLen = Math.max(80, estimateCharsPerCell(cellWidth, cellHeight, fontSize));
    var expanded = [];
    for (var i = 0; i < tickets.length; i++) {
      var ticket = tickets[i];
      var chunks = splitTextByChunks(ticket.text || '', maxLen);
      for (var c = 0; c < chunks.length; c++) {
        expanded.push({
          type: 'text',
          page: ticket.page,
          suffix: chunks.length > 1 ? '.' + (c + 1) : '',
          text: chunks[c]
        });
      }
    }
    return expanded;
  }

  function renderLayout(tickets, options) {
    options = options || {};
    var ticketsPerPage = options.ticketsPerPage || 4;
    var orientation = options.orientation || 'portrait';
    var margins = options.margins || { top: 10, right: 10, bottom: 10, left: 10 };
    var gap = options.gap || 5;
    var fontSize = options.fontSize || 10;
    var showNumbers = options.showPageNumbers !== false;
    var cutMarks = options.cutMarks || false;
    var mode = options.mode || 'page';

    var grid = getGrid(ticketsPerPage);
    var cols = grid.cols;
    var rows = grid.rows;

    var sheetWidth = orientation === 'landscape' ? A4.height : A4.width;
    var sheetHeight = orientation === 'landscape' ? A4.width : A4.height;
    var usableWidth = sheetWidth - margins.left - margins.right;
    var usableHeight = sheetHeight - margins.top - margins.bottom;
    var cellWidth = (usableWidth - gap * (cols - 1)) / cols;
    var cellHeight = (usableHeight - gap * (rows - 1)) / rows;

    // Для текстового режима разбиваем длинные билеты на части
    var layoutTickets = expandTextTickets(tickets, ticketsPerPage, mode, cellWidth, cellHeight, fontSize);

    var ticketsPerSheet = cols * rows;
    var totalSheets = Math.ceil(layoutTickets.length / ticketsPerSheet);

    var container = document.createElement('div');
    container.className = 'preview-pages';

    var sheetWidth = orientation === 'landscape' ? A4.height : A4.width;
    var sheetHeight = orientation === 'landscape' ? A4.width : A4.height;

    var usableWidth = sheetWidth - margins.left - margins.right;
    var usableHeight = sheetHeight - margins.top - margins.bottom;

    var cellWidth = (usableWidth - gap * (cols - 1)) / cols;
    var cellHeight = (usableHeight - gap * (rows - 1)) / rows;

    for (var sheetIndex = 0; sheetIndex < totalSheets; sheetIndex++) {
      var sheet = document.createElement('div');
      sheet.className = 'preview-page print-sheet' + (orientation === 'landscape' ? ' landscape' : '');
      sheet.style.setProperty('--cols', cols);
      sheet.style.setProperty('--rows', rows);
      sheet.style.setProperty('--gap', gap + 'mm');
      sheet.style.setProperty('--margin-top', margins.top + 'mm');
      sheet.style.setProperty('--margin-right', margins.right + 'mm');
      sheet.style.setProperty('--margin-bottom', margins.bottom + 'mm');
      sheet.style.setProperty('--margin-left', margins.left + 'mm');
      sheet.style.setProperty('--ticket-font-size', fontSize + 'pt');
      sheet.style.width = sheetWidth + 'mm';
      sheet.style.height = sheetHeight + 'mm';

      var label = document.createElement('div');
      label.className = 'preview-page__label';
      label.textContent = 'Лист ' + (sheetIndex + 1) + ' из ' + totalSheets;
      sheet.appendChild(label);

      var start = sheetIndex * ticketsPerSheet;
      var end = Math.min(start + ticketsPerSheet, layoutTickets.length);

      for (var i = start; i < end; i++) {
        var ticket = layoutTickets[i];
        var cell = document.createElement('div');
        cell.className = 'print-ticket';

        if (showNumbers) {
          var num = document.createElement('div');
          num.className = 'print-ticket__number';
          num.textContent = '#' + ticket.page + (ticket.suffix || '');
          cell.appendChild(num);
        }

        var content = document.createElement('div');
        content.className = mode === 'page' ? 'print-ticket__page' : 'print-ticket__text';

        if (mode === 'page' && ticket.canvas) {
          var img = document.createElement('img');
          img.src = ticket.canvas.toDataURL('image/png');
          img.alt = 'Билет ' + ticket.page;
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

      var emptyCells = ticketsPerSheet - (end - start);
      for (var j = 0; j < emptyCells; j++) {
        var emptyCell = document.createElement('div');
        emptyCell.className = 'print-ticket';
        emptyCell.style.opacity = '0';
        sheet.appendChild(emptyCell);
      }

      if (cutMarks && sheetIndex === 0) {
        addCutMarks(sheet, cols, rows, cellWidth, cellHeight, gap, margins);
      }

      var wrapper = document.createElement('div');
      wrapper.className = 'preview-page-wrapper';

      var sizeLabel = document.createElement('div');
      sizeLabel.className = 'preview-page__size';
      sizeLabel.textContent = sheetWidth + '×' + sheetHeight + ' мм';
      sheet.appendChild(sizeLabel);

      wrapper.appendChild(sheet);
      container.appendChild(wrapper);
    }

    return container;
  }

  function addCutMarks(sheet, cols, rows, cellWidth, cellHeight, gap, margins) {
    var c, r, x, y, line;
    for (c = 1; c < cols; c++) {
      x = margins.left + c * cellWidth + (c - 1) * gap + gap / 2;
      line = document.createElement('div');
      line.className = 'cut-mark vertical';
      line.style.left = x + 'mm';
      line.style.top = '0';
      line.style.bottom = '0';
      sheet.appendChild(line);
    }

    for (r = 1; r < rows; r++) {
      y = margins.top + r * cellHeight + (r - 1) * gap + gap / 2;
      line = document.createElement('div');
      line.className = 'cut-mark horizontal';
      line.style.top = y + 'mm';
      line.style.left = '0';
      line.style.right = '0';
      sheet.appendChild(line);
    }
  }

  function getLayoutInfo(tickets, options) {
    options = options || {};
    var grid = getGrid(options.ticketsPerPage || 4);
    var cols = grid.cols;
    var rows = grid.rows;
    var perSheet = cols * rows;

    var orientation = options.orientation || 'portrait';
    var margins = options.margins || { top: 10, right: 10, bottom: 10, left: 10 };
    var gap = options.gap || 5;
    var fontSize = options.fontSize || 10;
    var mode = options.mode || 'page';

    var sheetWidth = orientation === 'landscape' ? A4.height : A4.width;
    var sheetHeight = orientation === 'landscape' ? A4.width : A4.height;
    var usableWidth = sheetWidth - margins.left - margins.right;
    var usableHeight = sheetHeight - margins.top - margins.bottom;
    var cellWidth = (usableWidth - gap * (cols - 1)) / cols;
    var cellHeight = (usableHeight - gap * (rows - 1)) / rows;

    var layoutTickets = expandTextTickets(tickets, options.ticketsPerPage || 4, mode, cellWidth, cellHeight, fontSize);

    return {
      totalTickets: tickets.length,
      totalChunks: layoutTickets.length,
      ticketsPerSheet: perSheet,
      totalSheets: Math.ceil(layoutTickets.length / perSheet),
      grid: grid
    };
  }

  global.Layout = {
    getGrid: getGrid,
    renderLayout: renderLayout,
    getLayoutInfo: getLayoutInfo
  };
})(window);
