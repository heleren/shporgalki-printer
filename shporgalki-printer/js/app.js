// app.js
// Главный модуль приложения

(function () {
  'use strict';

  // Состояние приложения
  var state = {
    pdf: null,
    file: null,
    tickets: [],
    mode: 'page',
    settings: {
      ticketsPerPage: 4,
      fontSize: 10,
      orientation: 'portrait',
      marginTop: 10,
      marginRight: 10,
      marginBottom: 10,
      marginLeft: 10,
      gapX: 5,
      pageScale: 1.5,
      showPageNumbers: true,
      cutMarks: false,
      cropPages: true,
      pageRange: ''
    }
  };

  // Масштаб предпросмотра
  var previewZoom = {
    current: 1,
    min: 0.3,
    max: 2,
    step: 0.1
  };

  // DOM элементы
  var els = {};

  function init() {
    cacheElements();
    registerServiceWorker();
    bindEvents();
    updateSettingsFromDOM();
    updateValueLabels();
    showStatus('Загрузите PDF, чтобы начать', 'success');
  }

  function cacheElements() {
    els.dropZone = document.getElementById('dropZone');
    els.pdfInput = document.getElementById('pdfInput');
    els.fileInfo = document.getElementById('fileInfo');
    els.modePage = document.getElementById('modePage');
    els.modeText = document.getElementById('modeText');
    els.ticketsPerPage = document.getElementById('ticketsPerPage');
    els.fontSize = document.getElementById('fontSize');
    els.fontSizeValue = document.getElementById('fontSizeValue');
    els.orientation = document.getElementById('orientation');
    els.marginTop = document.getElementById('marginTop');
    els.marginBottom = document.getElementById('marginBottom');
    els.marginLeft = document.getElementById('marginLeft');
    els.marginRight = document.getElementById('marginRight');
    els.gapX = document.getElementById('gapX');
    els.pageScale = document.getElementById('pageScale');
    els.pageScaleValue = document.getElementById('pageScaleValue');
    els.showPageNumbers = document.getElementById('showPageNumbers');
    els.cutMarks = document.getElementById('cutMarks');
    els.cropPages = document.getElementById('cropPages');
    els.pageRange = document.getElementById('pageRange');
    els.previewBtn = document.getElementById('previewBtn');
    els.printBtn = document.getElementById('printBtn');
    els.downloadBtn = document.getElementById('downloadBtn');
    els.statusSection = document.getElementById('statusSection');
    els.status = document.getElementById('status');
    els.previewSection = document.getElementById('previewSection');
    els.previewPages = document.getElementById('previewPages');
    els.zoomIn = document.getElementById('zoomIn');
    els.zoomOut = document.getElementById('zoomOut');
    els.zoomFit = document.getElementById('zoomFit');
    els.zoomValue = document.getElementById('zoomValue');
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(function () {
          console.log('Service Worker зарегистрирован');
        })
        .catch(function (err) {
          console.error('Ошибка Service Worker:', err);
        });
    }
  }

  function bindEvents() {
    // Загрузка файла
    els.dropZone.addEventListener('click', function () {
      els.pdfInput.click();
    });
    els.pdfInput.addEventListener('change', handleFileSelect);

    els.dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      els.dropZone.classList.add('dragover');
    });

    els.dropZone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      els.dropZone.classList.remove('dragover');
    });

    els.dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      els.dropZone.classList.remove('dragover');
      var file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    });

    // Режимы
    els.modePage.addEventListener('click', function () {
      setMode('page');
    });
    els.modeText.addEventListener('click', function () {
      setMode('text');
    });

    // Настройки
    var settingInputs = [
      els.ticketsPerPage, els.fontSize, els.orientation,
      els.marginTop, els.marginBottom, els.marginLeft, els.marginRight,
      els.gapX, els.pageScale, els.showPageNumbers, els.cutMarks, els.cropPages, els.pageRange
    ];
    settingInputs.forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () {
        updateSettingsFromDOM();
        updateValueLabels();
        if (state.tickets.length) {
          debouncedPreview();
        }
      });
    });

    // Кнопки
    els.previewBtn.addEventListener('click', generatePreview);
    els.printBtn.addEventListener('click', handlePrint);
    els.downloadBtn.addEventListener('click', handleDownload);

    // Zoom
    els.zoomIn.addEventListener('click', function () {
      changeZoom(0.1);
    });
    els.zoomOut.addEventListener('click', function () {
      changeZoom(-0.1);
    });
    els.zoomFit.addEventListener('click', fitPreviewToWidth);

    window.addEventListener('resize', debouncedFitPreview);
  }

  function updateValueLabels() {
    els.fontSizeValue.textContent = els.fontSize.value + 'pt';
    els.pageScaleValue.textContent = els.pageScale.value + 'x';
  }

  function updateSettingsFromDOM() {
    state.settings = {
      ticketsPerPage: parseInt(els.ticketsPerPage.value, 10),
      fontSize: parseFloat(els.fontSize.value),
      orientation: els.orientation.value,
      marginTop: parseFloat(els.marginTop.value),
      marginRight: parseFloat(els.marginRight.value),
      marginBottom: parseFloat(els.marginBottom.value),
      marginLeft: parseFloat(els.marginLeft.value),
      gapX: parseFloat(els.gapX.value),
      pageScale: parseFloat(els.pageScale.value),
      showPageNumbers: els.showPageNumbers.checked,
      cutMarks: els.cutMarks.checked,
      cropPages: els.cropPages.checked,
      pageRange: (els.pageRange.value || '').trim()
    };
  }

  function handleFileSelect(e) {
    var file = e.target.files[0];
    if (file) {
      // Сбрасываем input, чтобы повторный выбор того же файла сработал
      e.target.value = '';
      loadFile(file);
    }
  }

  function loadFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showStatus('Пожалуйста, выберите PDF-файл', 'error');
      return;
    }

    setLoading(true);
    showStatus('Загрузка PDF...');

    window.PDFLoader.loadPDF(file).then(function (pdf) {
      state.pdf = pdf;
      state.file = file;

      var info = window.PDFLoader.getPDFInfo(pdf, file);
      els.fileInfo.innerHTML = '<strong>' + escapeHtml(info.name) + '</strong><br>Страниц: ' + info.pages + ' • ' + formatBytes(info.size);
      els.fileInfo.classList.add('visible');

      showStatus('Извлечение билетов...');
      return extractTicketsData();
    }).then(function () {
      var layoutInfo = window.Layout.getLayoutInfo(state.tickets, {
        ticketsPerPage: state.settings.ticketsPerPage,
        orientation: state.settings.orientation,
        margins: {
          top: state.settings.marginTop,
          right: state.settings.marginRight,
          bottom: state.settings.marginBottom,
          left: state.settings.marginLeft
        },
        gap: state.settings.gapX,
        fontSize: state.settings.fontSize,
        mode: state.mode
      });
      showStatus(
        'Готово: ' + layoutInfo.totalTickets + ' билетов, ' + layoutInfo.totalSheets + ' листов (сетка ' + layoutInfo.grid.cols + '×' + layoutInfo.grid.rows + ')',
        'success'
      );
      return generatePreview();
    }).catch(function (err) {
      console.error(err);
      showStatus('Ошибка: ' + (err.message || 'Не удалось загрузить PDF'), 'error');
    }).finally(function () {
      setLoading(false);
    });
  }

  function extractTicketsData() {
    if (!state.pdf) return Promise.resolve();
    return window.PDFLoader.extractTickets(state.pdf, {
      mode: state.mode,
      scale: state.settings.pageScale,
      crop: state.settings.cropPages,
      pageRange: state.settings.pageRange
    }).then(function (tickets) {
      state.tickets = tickets;
    });
  }

  function setMode(mode) {
    state.mode = mode;
    els.modePage.classList.toggle('active', mode === 'page');
    els.modeText.classList.toggle('active', mode === 'text');

    if (state.pdf) {
      extractTicketsData().then(function () {
        return generatePreview();
      }).catch(function (err) {
        console.error(err);
      });
    }
  }

  function generatePreview() {
    if (!state.tickets.length) {
      showStatus('Сначала загрузите PDF', 'error');
      return Promise.resolve();
    }

    setLoading(true);
    showStatus('Формирование предпросмотра...');

    return new Promise(function (resolve) {
      // Небольшая задержка, чтобы UI успел обновить статус
      setTimeout(function () {
        try {
          var container = window.Layout.renderLayout(state.tickets, {
            ticketsPerPage: state.settings.ticketsPerPage,
            orientation: state.settings.orientation,
            margins: {
              top: state.settings.marginTop,
              right: state.settings.marginRight,
              bottom: state.settings.marginBottom,
              left: state.settings.marginLeft
            },
            gap: state.settings.gapX,
            fontSize: state.settings.fontSize,
            showPageNumbers: state.settings.showPageNumbers,
            cutMarks: state.settings.cutMarks,
            mode: state.mode
          });

          els.previewPages.innerHTML = '';
          els.previewPages.appendChild(container);
          els.previewSection.hidden = false;

          // Автоматически подгоняем под ширину экрана
          setTimeout(function () {
            fitPreviewToWidth();
            fitTextFontSize();
          }, 10);

          var info = window.Layout.getLayoutInfo(state.tickets, {
            ticketsPerPage: state.settings.ticketsPerPage,
            orientation: state.settings.orientation,
            margins: {
              top: state.settings.marginTop,
              right: state.settings.marginRight,
              bottom: state.settings.marginBottom,
              left: state.settings.marginLeft
            },
            gap: state.settings.gapX,
            fontSize: state.settings.fontSize,
            mode: state.mode
          });
          showStatus('Предпросмотр: ' + info.totalSheets + ' лист(а/ов) A4', 'success');
          resolve();
        } catch (err) {
          console.error(err);
          showStatus('Ошибка предпросмотра: ' + err.message, 'error');
          resolve();
        }
      }, 50);
    }).finally(function () {
      setLoading(false);
    });
  }

  var previewTimeout;
  function debouncedPreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(generatePreview, 400);
  }

  function handlePrint() {
    if (!state.tickets.length) {
      showStatus('Сначала загрузите PDF', 'error');
      return;
    }
    window.Export.printPreview();
  }

  function handleDownload() {
    if (!state.tickets.length) {
      showStatus('Сначала загрузите PDF', 'error');
      return;
    }

    setLoading(true);
    showStatus('Создание PDF...');

    var filename = window.Export.generateFilename(state.file ? state.file.name : 'shporgalki');
    window.Export.downloadPDF(els.previewPages, filename, state.settings.orientation).then(function () {
      showStatus('PDF сохранён', 'success');
    }).catch(function (err) {
      console.error(err);
      showStatus('Ошибка сохранения: ' + err.message, 'error');
    }).finally(function () {
      setLoading(false);
    });
  }

  function showStatus(message, type) {
    els.statusSection.hidden = false;
    els.status.textContent = message;
    els.status.className = 'status' + (type ? ' ' + type : '');
  }

  function setLoading(isLoading) {
    document.body.classList.toggle('loading', isLoading);
    els.previewBtn.disabled = isLoading;
    els.printBtn.disabled = isLoading;
    els.downloadBtn.disabled = isLoading;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Б';
    var k = 1024;
    var sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Zoom functions
  function changeZoom(delta) {
    var newZoom = Math.round((previewZoom.current + delta) * 10) / 10;
    setZoom(Math.max(previewZoom.min, Math.min(previewZoom.max, newZoom)));
  }

  function setZoom(zoom) {
    previewZoom.current = zoom;
    applyPreviewZoom();
    updateZoomValue();
  }

  function updateZoomValue() {
    if (els.zoomValue) {
      els.zoomValue.textContent = Math.round(previewZoom.current * 100) + '%';
    }
  }

  function applyPreviewZoom() {
    if (!els.previewPages) return;
    var pages = els.previewPages.querySelectorAll('.preview-page');
    pages.forEach(function (page) {
      page.style.setProperty('--preview-zoom', previewZoom.current);
    });
  }

  function fitPreviewToWidth() {
    if (!els.previewPages) return;
    var pages = els.previewPages.querySelectorAll('.preview-page');
    if (!pages.length) return;

    var page = pages[0];
    var isLandscape = page.classList.contains('landscape');
    var pageWidthMm = isLandscape ? 297 : 210;
    var pageWidthPx = pageWidthMm * 3.779527559;
    var wrapperWidth = els.previewPages.clientWidth - 64; // padding
    var zoom = Math.max(previewZoom.min, Math.min(previewZoom.max, wrapperWidth / pageWidthPx));
    zoom = Math.round(zoom * 10) / 10;
    setZoom(zoom);
  }

  var fitPreviewTimeout;
  function debouncedFitPreview() {
    clearTimeout(fitPreviewTimeout);
    fitPreviewTimeout = setTimeout(fitPreviewToWidth, 200);
  }

  // Автоподгонка размера шрифта в текстовом режиме
  function fitTextFontSize() {
    if (state.mode !== 'text') return;
    if (!els.previewPages) return;

    var textBlocks = els.previewPages.querySelectorAll('.print-ticket__text');
    var minFontSizePx = 8;
    var maxIterations = 30;

    textBlocks.forEach(function (block) {
      var style = window.getComputedStyle(block);
      var currentSize = parseFloat(style.fontSize);
      var iteration = 0;

      // Убираем фиксированный размер из переменной, чтобы мочь менять inline
      block.style.setProperty('--ticket-font-size', 'inherit');

      while (block.scrollHeight > block.clientHeight + 2 && currentSize > minFontSizePx && iteration < maxIterations) {
        currentSize -= 0.5;
        block.style.fontSize = currentSize + 'px';
        iteration++;
      }

      // Если текст всё равно не влез — добавляем визуальный индикатор обрезки
      if (block.scrollHeight > block.clientHeight + 2) {
        block.classList.add('text-overflow');
      } else {
        block.classList.remove('text-overflow');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
