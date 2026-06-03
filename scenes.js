const CONFIG = {
  timeline: [
    { id: "aereo",   label: "Vista Aérea" },
    { id: "pool",    label: "Pool"        },
    { id: "jardim",  label: "Jardim"      },
    { id: "living",  label: "Living"      },
    { id: "kitchen", label: "Kitchen"     },
  ],

  scenes: {
    aereo:   { video: "images/1.webm", pois: [] },
    pool:    { video: null,            pois: [] },
    living:  { video: null,            pois: [] },
    jardim:  { video: null,            pois: [] },
    kitchen: { video: null,            pois: [] },
  },

  sequences: {
    "aereo-to-pool": {
      folder: "images/seq/",
      prefix: "aereo_to_piscina_",
      from: 0,
      to: 47,
      pad: 2,
      ext: "jpg",
      fps: 30,
    },
    "pool-to-living": {
      folder: "images/seq/",
      prefix: "pool_to_living_",
      from: 0,
      to: 72,
      pad: 2,
      ext: "jpg",
      fps: 30,
    },
  },

  transitions: {
    aereo: { pool: "aereo-to-pool" },
    pool: { living: "pool-to-living" },
  },
};
