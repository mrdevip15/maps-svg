var simplemaps_countrymap_mapdata={
  main_settings: {
   //General settings
    width: "responsive", //'700' or 'responsive'
    background_color: "#FFFFFF",
    background_transparent: "yes",
    border_color: "#ffffff",
    
    //State defaults
    state_description: "State description",
    state_color: "#2D5AA6",
    state_hover_color: "#1E3A5F",
    state_url: "",
    border_size: 1.5,
    all_states_inactive: "no",
    all_states_zoomable: "yes",
    
    //Location defaults
    location_description: "Location description",
    location_url: "",
    location_color: "#2D5AA6",
    location_opacity: 0.8,
    location_hover_opacity: 1,
    location_size: 25,
    location_type: "square",
    location_image_source: "frog.png",
    location_border_color: "#FFFFFF",
    location_border: 2,
    location_hover_border: 2.5,
    all_locations_inactive: "no",
    all_locations_hidden: "no",
    
    //Label defaults
    label_color: "#ffffff",
    label_hover_color: "#ffffff",
    label_size: 16,
    label_font: "Arial",
    label_display: "auto",
    label_scale: "yes",
    hide_labels: "no",
    hide_eastern_labels: "no",
   
    //Zoom settings
    zoom: "yes",
    manual_zoom: "yes",
    back_image: "no",
    initial_back: "no",
    initial_zoom: "-1",
    initial_zoom_solo: "no",
    region_opacity: 1,
    region_hover_opacity: 0.6,
    zoom_out_incrementally: "yes",
    zoom_percentage: 0.99,
    zoom_time: 0.5,
    
    //Popup settings
    popup_color: "white",
    popup_opacity: 0.9,
    popup_shadow: 1,
    popup_corners: 5,
    popup_font: "12px/1.5 Verdana, Arial, Helvetica, sans-serif",
    popup_nocss: "no",
    
    //Advanced settings
    div: "map",
    auto_load: "yes",
    url_new_tab: "no",
    images_directory: "default",
    fade_time: 0.1,
    link_text: "View Website",
    popups: "detect",
    state_image_url: "",
    state_image_position: "",
    location_image_url: ""
  },
  state_specific: {
    IDAC: {
      name: "Aceh",
      hide: "yes"
    },
    IDBA: {
      name: "Bali",
      hide: "yes"
    },
    IDBB: {
      name: "Bangka-Belitung",
      hide: "yes"
    },
    IDBE: {
      name: "Bengkulu",
      hide: "yes"
    },
    IDBT: {
      name: "Banten",
      hide: "yes"
    },
    IDGO: {
      name: "Gorontalo",
      color: "#4A90E2",
      hide: "no"
    },
    IDJA: {
      name: "Jambi",
      hide: "yes"
    },
    IDJB: {
      name: "Jawa Barat",
      hide: "yes"
    },
    IDJI: {
      name: "Jawa Timur",
      hide: "yes"
    },
    IDJK: {
      name: "Jakarta Raya",
      hide: "yes"
    },
    IDJT: {
      name: "Jawa Tengah",
      hide: "yes"
    },
    IDKB: {
      name: "Kalimantan Barat",
      hide: "yes"
    },
    IDKI: {
      name: "Kalimantan Timur",
      hide: "yes"
    },
    IDKR: {
      name: "Kepulauan Riau",
      hide: "yes"
    },
    IDKS: {
      name: "Kalimantan Selatan",
      hide: "yes"
    },
    IDKT: {
      name: "Kalimantan Tengah",
      hide: "yes"
    },
    IDKU: {
      name: "North Kalimantan",
      hide: "yes"
    },
    IDLA: {
      name: "Lampung",
      hide: "yes"
    },
    IDMA: {
      name: "Maluku",
      color: "#E74C3C",
      hide: "no"
    },
    IDMU: {
      name: "Maluku Utara",
      color: "#E8907B",
      hide: "no"
    },
    IDNB: {
      name: "Nusa Tenggara Barat",
      hide: "yes"
    },
    IDNT: {
      name: "Nusa Tenggara Timur",
      hide: "yes"
    },
    IDPA: {
      name: "Papua",
      color: "#27AE60",
      hide: "no"
    },
    IDPB: {
      name: "Papua Barat",
      color: "#7FD8BE",
      hide: "no"
    },
    IDRI: {
      name: "Riau",
      hide: "yes"
    },
    IDSA: {
      name: "Sulawesi Utara",
      color: "#2D5AA6",
      hide: "no"
    },
    IDSB: {
      name: "Sumatera Barat",
      hide: "yes"
    },
    IDSG: {
      name: "Sulawesi Tenggara",
      color: "#3498DB",
      hide: "no"
    },
    IDSN: {
      name: "Sulawesi Selatan",
      color: "#8E44AD",
      hide: "no"
    },
    IDSR: {
      name: "Sulawesi Barat",
      color: "#D68910",
      hide: "no"
    },
    IDSS: {
      name: "Sumatera Selatan",
      hide: "yes"
    },
    IDST: {
      name: "Sulawesi Tengah",
      color: "#16A085",
      hide: "no"
    },
    IDSU: {
      name: "Sumatera Utara",
      hide: "yes"
    },
    IDYO: {
      name: "Yogyakarta",
      hide: "yes"
    }
  },
  locations: {},
  labels: {
    IDGO: {
      name: "Gorontalo",
      parent_id: "IDGO"
    },
    IDMA: {
      name: "Maluku",
      parent_id: "IDMA"
    },
    IDMU: {
      name: "Maluku Utara",
      parent_id: "IDMU"
    },
    IDPA: {
      name: "Papua",
      parent_id: "IDPA"
    },
    IDPB: {
      name: "Papua Barat",
      parent_id: "IDPB"
    },
    IDSA: {
      name: "Sulawesi Utara",
      parent_id: "IDSA"
    },
    IDSG: {
      name: "Sulawesi Tenggara",
      parent_id: "IDSG"
    },
    IDSN: {
      name: "Sulawesi Selatan",
      parent_id: "IDSN"
    },
    IDSR: {
      name: "Sulawesi Barat",
      parent_id: "IDSR"
    },
    IDST: {
      name: "Sulawesi Tengah",
      parent_id: "IDST"
    }
  },
  legend: {
    entries: []
  },
  regions: {}
};