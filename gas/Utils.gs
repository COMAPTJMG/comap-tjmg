/**
 * Utils.gs — Helpers compartilhados
 */

function log_(nivel, usuario, acao, detalhes) {
  try {
    const sh = ss_().getSheetByName(CONFIG.LOG_SHEET);
    if (!sh) return;
    sh.appendRow([
      new Date(),
      nivel,
      usuario || '?',
      acao || '?',
      detalhes ? JSON.stringify(detalhes) : ''
    ]);
  } catch (e) {
    // Nunca quebra
  }
}