// app.js
// Главный модуль приложения

import { loadPDF, extractTickets, getPDFInfo } from './pdf-loader.js';
import { renderLayout, getLayoutInfo } from './layout.js';
import { printPreview, downloadPDF, generateFilename } from './export.js';

// Состояние приложения
const state = {
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
    cutMarks: false
  }
};

// DOM элементы
const els = {
  dropZone: document.getElementById('dropZone'),
  pdfInput: document.getElementById('pdfInput'),
  fileInfo: document.getElementById('fileInfo'),
  modePage: document.getElementById('modePage'),
  modeText: document.getElementById('modeText'),
  ticketsPerPage: document.getElementById('ticketsPerPage'),
  fontSize: document.getElementById('fontSize'),
  fontSizeValue: document.getElementById('fontSizeValue'),
  orientation: document.getElementById('orientation'),
  marginTop: document.getElementById('marginTop'),
  marginBottom: document.getElementById('marginBottom'),
  marginLeft: document.getElementById('marginLeft'),
  marginRight: document.getElementById('marginRight'),
  gapX: document.getElementById('gapX'),
  pageScale: document.getElementById('pageScale'),
  pageScaleValue: document.getElementById('pageScaleValue'),
  showPageNumbers: document.getElementById('showPageNumbers'),
  cutMarks: document.getElementById('cutMarks'),
  previewBtn: document.getElementById('previewBtn'),
  printBtn: document.getElementById('printBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  statusSection: document.getElementById('statusSection'),
  status: document.getElementById('status'),
  previewSection: document.getElementById('previewSection'),
  previewPages: document.getElementById('previewPages')
};

// Инициализация
function init() {
  registerServiceWorker();
  bindEvents();
  updateSettingsFromDOM();
  showStatus('Загрузите PDF, чтобы начать', 'success');
}

// Регистрация Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker зарегистрирован'))
      .catch(err => console.error('Ошибка Service Worker:', err));
  }
}

// Привязка событий
function bindEvents() {
  // Загрузка файла
  els.dropZone.addEventListener('click', () => els.pdfInput.click());
  els.pdfInput.addEventListener('change', handleFileSelect);

  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('dragover');
  });

  els.dropZone.addEventListener('dragleave', () => {
    els.dropZone.classList.remove('dragover');
  });

  els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });

  // Режимы
  els.modePage.addEventListener('click', () => setMode('page'));
  els.modeText.addEventListener('click', () => setMode('text'));

  // Настройки
  const settingInputs = [
    els.ticketsPerPage, els.fontSize, els.orientation,
    els.marginTop, els.marginBottom, els.marginLeft, els.marginRight,
    els.gapX, els.pageScale, els.showPageNumbers, els.cutMarks
  ];
  settingInputs.forEach(input => {
    input.addEventListener('input', () => {
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
}

// Обновление текущих значений слайдеров
function updateValueLabels() {
  els.fontSizeValue.textContent = `${els.fontSize.value}pt`;
  els.pageScaleValue.textContent = `${els.pageScale.value}x`;
}

// Чтение настроек из DOM
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
    cutMarks: els.cutMarks.checked
  };
}

// Выбор файла через input
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) loadFile(file);
}

// Загрузка и обработка файла
async function loadFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showStatus('Пожалуйста, выберите PDF-файл', 'error');
    return;
  }

  setLoading(true);
  showStatus('Загрузка PDF...');

  try {
    state.pdf = await loadPDF(file);
    state.file = file;

    const info = getPDFInfo(state.pdf, file);
    els.fileInfo.innerHTML = `
      <strong>${info.name}</strong><br>
      Страниц: ${info.pages} • ${formatBytes(info.size)}
    `;
    els.fileInfo.classList.add('visible');

    showStatus('Извлечение билетов...');
    await extractTicketsData();

    const layoutInfo = getLayoutInfo(state.tickets, state.settings);
    showStatus(
      `Готово: ${layoutInfo.totalTickets} билетов, ${layoutInfo.totalSheets} листов (сетка ${layoutInfo.grid.cols}×${layoutInfo.grid.rows})`,
      'success'
    );

    await generatePreview();
  } catch (err) {
    console.error(err);
    showStatus(`Ошибка: ${err.message || 'Не удалось загрузить PDF'}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function extractTicketsData() {
  if (!state.pdf) return;
  state.tickets = await extractTickets(state.pdf, state.mode, state.settings.pageScale);
}

// Смена режима
function setMode(mode) {
  state.mode = mode;
  els.modePage.classList.toggle('active', mode === 'page');
  els.modeText.classList.toggle('active', mode === 'text');

  if (state.pdf) {
    extractTicketsData().then(() => generatePreview());
  }
}

// Генерация предпросмотра
async function generatePreview() {
  if (!state.tickets.length) {
    showStatus('Сначала загрузите PDF', 'error');
    return;
  }

  setLoading(true);
  showStatus('Формирование предпросмотра...');

  try {
    const container = renderLayout(state.tickets, {
      ...state.settings,
      mode: state.mode
    });

    els.previewPages.innerHTML = '';
    els.previewPages.appendChild(container);
    els.previewSection.hidden = false;

    const info = getLayoutInfo(state.tickets, state.settings);
    showStatus(
      `Предпросмотр: ${info.totalSheets} лист(а/ов) A4`,
      'success'
    );
  } catch (err) {
    console.error(err);
    showStatus(`Ошибка предпросмотра: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

let previewTimeout;
function debouncedPreview() {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(generatePreview, 400);
}

// Печать
function handlePrint() {
  if (!state.tickets.length) {
    showStatus('Сначала загрузите PDF', 'error');
    return;
  }
  printPreview();
}

// Скачивание PDF
async function handleDownload() {
  if (!state.tickets.length) {
    showStatus('Сначала загрузите PDF', 'error');
    return;
  }

  setLoading(true);
  showStatus('Создание PDF...');

  try {
    const filename = generateFilename(state.file?.name || 'shporgalki');
    await downloadPDF(els.previewPages, filename, state.settings.orientation);
    showStatus('PDF сохранён', 'success');
  } catch (err) {
    console.error(err);
    showStatus(`Ошибка сохранения: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// Показ статуса
function showStatus(message, type = '') {
  els.statusSection.hidden = false;
  els.status.textContent = message;
  els.status.className = 'status' + (type ? ` ${type}` : '');
}

// Индикатор загрузки
function setLoading(isLoading) {
  document.body.classList.toggle('loading', isLoading);
  els.previewBtn.disabled = isLoading;
  els.printBtn.disabled = isLoading;
  els.downloadBtn.disabled = isLoading;
}

// Форматирование байтов
function formatBytes(bytes) {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Запуск
init();
