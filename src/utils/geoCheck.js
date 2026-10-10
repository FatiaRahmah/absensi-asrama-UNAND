/**
 * geoCheck.js — Validasi radius geolokasi untuk asrama UNAND
 * Radius: 30 meter dari titik pusat masing-masing gedung
 */

const RADIUS_METER = 30;

/** Daftar koordinat pusat tiap gedung asrama UNAND */
const ASRAMA_LOCATIONS = [
  { nama: 'Asrama Putih',    lat: -0.9175608759148889,  lng: 100.4539944702006  },
  { nama: 'Asrama Hijau',    lat: -0.9176439133625462,  lng: 100.45354924011889 },
  { nama: 'Asrama Orange',   lat: -0.9176785122985052,  lng: 100.45324011664249 },
  { nama: 'Asrama RPX',      lat: -0.9163932858161632,  lng: 100.45447760367466 },
  { nama: 'Asrama Rusunawa', lat: -0.916389185413046,   lng: 100.4540182997764  },
  { nama: 'Asrama Pupera 1', lat: -0.9162743741235517,  lng: 100.453876817772   },
  { nama: 'Asrama Menpera',  lat: -0.9168135771080848,  lng: 100.45333344484989 },
  { nama: 'Asrama Roesma',   lat: -0.9164279309751486,  lng: 100.45310895177197 }
];

/**
 * Haversine formula — menghitung jarak (meter) antara dua titik koordinat
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} jarak dalam meter
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radius bumi dalam meter
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Periksa apakah koordinat berada dalam radius 30m dari salah satu asrama UNAND.
 * @param {number} lat
 * @param {number} lng
 * @returns {{ allowed: boolean, gedungNama: string|null, jarakMeter: number }}
 */
function checkAsramaRadius(lat, lng) {
  let closestNama = null;
  let closestJarak = Infinity;

  for (const asrama of ASRAMA_LOCATIONS) {
    const jarak = haversineDistance(lat, lng, asrama.lat, asrama.lng);
    if (jarak < closestJarak) {
      closestJarak = jarak;
      closestNama = asrama.nama;
    }
  }

  return {
    allowed: closestJarak <= RADIUS_METER,
    gedungNama: closestNama,
    jarakMeter: Math.round(closestJarak)
  };
}

module.exports = { checkAsramaRadius, haversineDistance, ASRAMA_LOCATIONS, RADIUS_METER };
