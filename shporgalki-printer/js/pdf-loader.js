// pdf-loader.js
// Загрузка PDF и извлечение билетов

(function (global) {
  'use strict';

  const pdfjsLib = window.pdfjsLib;
  if (pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
  }

  function loadPDF(source) {
    if (!pdfjsLib) {
      return Promise.reject(new Error('PDF.js не загружен. Проверьте подключение к интернету.'));
    }

    var data;
    if (source instanceof File) {
      data = source.arrayBuffer();
    } else if (source instanceof ArrayBuffer) {
      data = Promise.resolve(source);
    } else {
      return Promise.reject(new Error('Неподдерживаемый источник PDF'));
    }

    return data.then(function (buffer) {
      return pdfjsLib.getDocument({ data: buffer }).promise;
    });
  }

  function cropCanvas(canvas, threshold) {
    threshold = threshold || 248;
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var imageData = ctx.getImageData(0, 0, width, height);
    var data = imageData.data;

    function isEmpty(row, col) {
      var index = (row * width + col) * 4;
      var r = data[index];
      var g = data[index + 1];
      var b = data[index + 2];
      var a = data[index + 3];
      return (r >= threshold && g >= threshold && b >= threshold) || a < 10;
    }

    function rowIsEmpty(row) {
      for (var col = 0; col < width; col++) {
        if (!isEmpty(row, col)) return false;
      }
      return true;
    }

    function colIsEmpty(col, topBound, bottomBound) {
      for (var row = topBound; row <= bottomBound; row++) {
        if (!isEmpty(row, col)) return false;
      }
      return true;
    }

    var top = 0;
    var bottom = height - 1;
    var left = 0;
    var right = width - 1;

    while (top < bottom && rowIsEmpty(top)) top++;
    while (bottom > top && rowIsEmpty(bottom)) bottom--;
    while (left < right && colIsEmpty(left, top, bottom)) left++;
    while (right > left && colIsEmpty(right, top, bottom)) right--;

    var newWidth = right - left + 1;
    var newHeight = bottom - top + 1;

    if (newWidth <= 10 || newHeight <= 10 || newWidth >= width || newHeight >= height) {
      return canvas;
    }

    var newCanvas = document.createElement('canvas');
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    var newCtx = newCanvas.getContext('2d');
    newCtx.drawImage(canvas, left, top, newWidth, newHeight, 0, 0, newWidth, newHeight);
    return newCanvas;
  }

  function parsePageRange(rangeStr, totalPages) {
    if (!rangeStr || !rangeStr.trim()) {
      var all = [];
      for (var i = 1; i <= totalPages; i++) all.push(i);
      return all;
    }

    var pages = {};
    var parts = rangeStr.replace(/\s/g, '').split(',');

    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      if (!part) continue;

      if (part.indexOf('-') !== -1) {
        var range = part.split('-');
        var start = parseInt(range[0], 10);
        var end = parseInt(range[1], 10);
        if (isNaN(start) || isNaN(end)) continue;
        start = Math.max(1, start);
        end = Math.min(totalPages, end);
        for (var n = start; n <= end; n++) {
          pages[n] = true;
        }
      } else {
        var num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
          pages[num] = true;
        }
      }
    }

    var result = Object.keys(pages).map(function (n) {
      return parseInt(n, 10);
    }).sort(function (a, b) {
      return a - b;
    });

    return result.length ? result : [1];
  }

  function extractTickets(pdf, options) {
    options = options || {};
    var mode = options.mode || 'page';
    var scale = options.scale || 1.5;
    var crop = options.crop !== false;
    var pageRange = options.pageRange || '';
    var tickets = [];
    var numPages = pdf.numPages;
    var pagesToProcess = parsePageRange(pageRange, numPages);

    function processIndex(idx) {
      if (idx >= pagesToProcess.length) {
        return Promise.resolve(tickets);
      }
      var i = pagesToProcess[idx];
      return pdf.getPage(i).then(function (page) {
        if (mode === 'page') {
          var viewport = page.getViewport({ scale: scale });
          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          return page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise.then(function () {
            if (crop) {
              canvas = cropCanvas(canvas);
            }
            tickets.push({
              type: 'page',
              page: i,
              canvas: canvas
            });
            if (page.cleanup) page.cleanup();
            return processIndex(idx + 1);
          });
        } else {
          return page.getTextContent().then(function (textContent) {
            var text = textContent.items.map(function (item) {
              return item.str;
            }).join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

            tickets.push({
              type: 'text',
              page: i,
              text: text
            });
            if (page.cleanup) page.cleanup();
            return processIndex(idx + 1);
          });
        }
      });
    }

    return processIndex(0);
  }

  function getPDFInfo(pdf, file) {
    return {
      name: file.name,
      size: file.size,
      pages: pdf.numPages
    };
  }

  global.PDFLoader = {
    loadPDF: loadPDF,
    extractTickets: extractTickets,
    getPDFInfo: getPDFInfo
  };
})(window);
