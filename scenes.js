const CONFIG = {
  timeline: [
    { id: "aereo", label: "Vista Aérea" },
    { id: "pool", label: "Pool" },
    { id: "jardim", label: "Jardim" },
    { id: "living", label: "Living" },
    { id: "kitchen", label: "Kitchen" },
  ],

  scenes: {
    aereo: { video: "images/1.webm", pois: [] },
    pool: { video: "images/3.webm", pois: [] },
    living: { video: "images/l_loop.webm", pois: [] },
    jardim: { video: "images/j_loop.webm", pois: [] },
    kitchen: { video: "images/k_loop.webm", pois: [] },
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
    },
    "living-to-pool": {
      folder: "images/seq/",
      prefix: "pool_to_living_",
      from: 0,
      to: 72,
      pad: 2,
      ext: "jpg",
      reverse: true,
    },
    "pool-to-kitchen": {
      folder: "images/seq/",
      prefix: "pool_to_kitchen_",
      from: 0,
      to: 72,
      pad: 2,
      ext: "jpg",
    },
    "kitchen-to-pool": {
      folder: "images/seq/",
      prefix: "pool_to_kitchen_",
      from: 0, to: 72, pad: 2, ext: "jpg",
      reverse: true,
    },
    "pool-to-jardim": {
      folder: "images/seq/",
      prefix: "pool_to_jardim_",
      from: 0, to: 72, pad: 2, ext: "jpg",
    },
    "jardim-to-pool": {
      folder: "images/seq/",
      prefix: "pool_to_jardim_",
      from: 0, to: 72, pad: 2, ext: "jpg",
      reverse: true,
    },
    "living-to-kitchen": {
      folder: "images/seq/",
      prefix: "living_to_kitchen_",
      from: 0, to: 72, pad: 2, ext: "jpg",
    },
    "kitchen-to-living": {
      folder: "images/seq/",
      prefix: "living_to_kitchen_",
      from: 0, to: 72, pad: 2, ext: "jpg",
      reverse: true,
    },
  },

  transitions: {
    aereo:   { pool:    "aereo-to-pool"    },
    pool:    { living:  "pool-to-living",
               kitchen: "pool-to-kitchen",
               jardim:  "pool-to-jardim"   },
    living:  { pool:    "living-to-pool",
               kitchen: "living-to-kitchen" },
    kitchen: { pool:    "kitchen-to-pool",
               living:  "kitchen-to-living" },
    jardim:  { pool:    "jardim-to-pool"   },
  },
};
