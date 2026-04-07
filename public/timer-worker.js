// Web Worker — таймер не зависит от вкладки или блокировки экрана
let _interval = null;

self.onmessage = function(e) {
  if (e.data.cmd === 'start') {
    if (_interval) clearInterval(_interval);
    const startTime = e.data.startTime; // Date.now() anchor
    _interval = setInterval(() => {
      self.postMessage({ elapsed: Math.floor((Date.now() - startTime) / 1000) });
    }, 500); // каждые 500мс для точности
  } else if (e.data.cmd === 'stop') {
    if (_interval) { clearInterval(_interval); _interval = null; }
  }
};
