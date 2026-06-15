// pdf-loader.js
// Загрузка PDF и извлечение билетов

const pdfjsLib = window.pdfjsLib;
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
}

/**
 * Загружает PDF-файл и возвращает объект Document PDF.js
 * @param {File|ArrayBuffer} source
 * @returns {Promise<PDFDocumentProxy>}
 */
export async function loadPDF(source) {
  if (!pdfjsLib) {
    throw new Error('PDF.js не загружен. Проверьте подключение к интернету.');
  }

  let data;
  if (source instanceof File) {
    data = await source.arrayBuffer();
  } else if (source instanceof ArrayBuffer) {
    data = source;
  } else {
    throw new Error('Неподдерживаемый источник PDF');
  }

  return pdfjsLib.getDocument({ data }).promise;
}

/**
 * Извлекает данные со всех страниц PDF
 * @param {PDFDocumentProxy} pdf
 * @param {'page'|'text'} mode
 * @param {number} scale
 * @returns {Promise<Array<{type: string, page: number, canvas?: HTMLCanvasElement, text?: string}>>}
 */
export async function extractTickets(pdf, mode = 'page', scale = 1.5) {
  const tickets = [];
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);

    if (mode === 'page') {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport
      }).promise;

      tickets.push({
        type: 'page',
        page: i,
        canvas
      });
    } else {
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      tickets.push({
        type: 'text',
        page: i,
        text
      });
    }

    page.cleanup && page.cleanup();
  }

  return tickets;
}

/**
 * Возвращает информацию о PDF
 * @param {PDFDocumentProxy} pdf
 * @param {File} file
 * @returns {Object}
 */
export function getPDFInfo(pdf, file) {
  return {
    name: file.name,
    size: file.size,
    pages: pdf.numPages
  };
}
