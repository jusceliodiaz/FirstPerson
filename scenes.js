const CONFIG = {
  video: 'images/1.webm',
  timeline: [
    { id: 'aereo',    label: 'Vista Aérea' },
    { id: 'pool',     label: 'Pool'        }
  ],
  poi: {
    x: 50, y: 55,
    label: 'Pool',
    target: 'pool'
  },
  sequences: {
    'aereo-to-pool': {
      folder: 'SEQ/',
      prefix: 'aereo_to_piscina_',
      from: 0,
      to: 47,
      pad: 2,      // 00, 01 … 47
      ext: 'jpg',
      fps: 30
    }
  },
  transitions: {
    aereo: { pool: 'aereo-to-pool' }
  }
};
