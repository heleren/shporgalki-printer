// export.js
// Печать и экспорт готового PDF

(function (global) {
  'use strict';

  function printPreview() {
    window.print();
  }

  function downloadPDF(previewPages, filename, orientation) {
    filename = filename || 'shporgalki.pdf';
    orientation = orientation || 'portrait';

    if (!window.html2canvas) {
      return Promise.reject(new Error('html2canvas не загружен. Проверьте подключение к интернету.'));
    }
    if (!window.jspdf) {
      return Promise.reject(new Error('jsPDF не загружен. Проверьте подключение к интернету.'));
    }

    var sheets = previewPages.querySelectorAll('.preview-page');
    if (!sheets.length) {
      return Promise.reject(new Error('Нет страниц для сохранения. Сначала сделайте предпросмотр.'));
    }

    var format = orientation === 'landscape' ? [297, 210] : [210, 297];
    var doc = new window.jspdf.jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format
    });

    var promises = [];
    for (var i = 0; i < sheets.length; i++) {
      promises.push(window.html2canvas(sheets[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      }));
    }

    return Promise.all(promises).then(function (canvases) {
      canvases.forEach(function (canvas, index) {
        if (index > 0) {
          doc.addPage(format, orientation);
        }
        var imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, format[0], format[1]);
      });
      doc.save(filename);
    });
  }

  function generateFilename(originalName) {
    var base = (originalName || 'shporgalki').replace(/\.pdf$/i, '');
    return base + '_print.pdf';
  }

  global.Export = {
    printPreview: printPreview,
    downloadPDF: downloadPDF,
    generateFilename: generateFilename
  };
})(window);
