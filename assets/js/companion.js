/**
 * companion.js v15 — compatibility shim
 * Full UI replaced by the command palette in main.js (⌘K).
 * This file is kept so cached HTML that still references it doesn't 500,
 * and to expose companionOpenPanel → palette for legacy links.
 */
(function(){
  window.companionOpenPanel = window.companionOpenPanel || function(){
    // will be overwritten by main.js boot; fallback opens nothing gracefully
    const p = document.getElementById('palette');
    if(p){ p.hidden=false; const b=document.getElementById('paletteBackdrop'); if(b) b.hidden=false; }
  };
  window.companionClosePanel = window.companionClosePanel || function(){
    const p=document.getElementById('palette'); if(p) p.hidden=true;
    const b=document.getElementById('paletteBackdrop'); if(b) b.hidden=true;
  };
  window.companionSetMode = window.companionSetMode || function(m){
    try{ sessionStorage.setItem('hermes_inference_mode', m); }catch{}
  };
})();
