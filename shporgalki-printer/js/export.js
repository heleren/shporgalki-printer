// export.js
// Печать и экспорт готового PDF

const { jsPDF } = window.jspdf || {};

/**
 * Открывает системный диалог печати
 */
export function printPreview() {
  window.print();
}

/**
 * Сохраняет раскладку в PDF файл
 * @param {HTMLElement} previewPages
 * @param {string} filename
 * @param {string} orientation
 */
export async function downloadPDF(previewPages, filename = 'shporgalki.pdf', orientation = 'portrait') {
  if (!window.html2canvas) {
    throw new Error('html2canvas не загружен. Проверьте подключение к интернету.');
  }
  if (!window.jspdf) {
    throw new Error('jsPDF не загружен. Проверьте подключение к интернету.');
  }

  const sheets = previewPages.querySelectorAll('.preview-page');
  if (!sheets.length) {
    throw new Error('Нет страниц для сохранения. Сначала сделайте предпросмотр.');
  }

  const unit = 'mm';
  const format = orientation === 'landscape' ? [297, 210] : [210, 297];
  const doc = new jsPDF({
    orientation,
    unit,
    format
  });

  const mmToPx = 96 / 25.4; // 96px на дюйм
  const pageWidthPx = format[0] * mmToPx;
  const pageHeightPx = format[1] * mmToPx;

  for (let i = 0; i < sheets.length; i++) {
    if (i > 0) {
      doc.addPage(format, orientation);
    }

    const sheet = sheets[i];
    const canvas = await window.html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, format[0], format[1]);
  }

  doc.save(filename);
}

/**
 * Возвращает предложенное имя файла
 * @param {string} originalName
 * @returns {string}
 */
export function generateFilename(originalName) {
  const base = originalName.replace(/\.pdf$/i, '') || 'shporgalki';
  return `${base}_print.pdf`;
}
