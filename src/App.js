import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import EXIF from "exif-js";

import "leaflet/dist/leaflet.css";
import "./App.css";

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

// ===== Firebase 設定（換成你的） =====
const firebaseConfig = {
  apiKey: "AIzaSyBqOaY9c3Uo6KkG8fD7Vx5L3X2P2x1H0q8",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "1059384934230",
  appId: "1:1059384934230:web:abcdef1234567890"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Leaflet Marker Icon 修正
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
});

function App() {
  const [markers, setMarkers] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadMarkers();
  }, []);

  async function loadMarkers() {
    const querySnapshot = await getDocs(collection(db, "images"));
    const data = [];
    querySnapshot.forEach((doc) => {
      data.push(doc.data());
    });
    setMarkers(data);
  }

  function getGpsFromExif(file) {
    return new Promise((resolve) => {
      EXIF.getData(file, function () {
        const lat = EXIF.getTag(this, "GPSLatitude");
        const lon = EXIF.getTag(this, "GPSLongitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
        const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";

        if (lat && lon) {
          const latDeg =
            lat[0] + lat[1] / 60 + lat[2] / 3600;
          const lonDeg =
            lon[0] + lon[1] / 60 + lon[2] / 3600;

          const finalLat = latRef === "S" ? -latDeg : latDeg;
          const finalLon = lonRef === "W" ? -lonDeg : lonDeg;

          resolve({ lat: finalLat, lng: finalLon });
        } else {
          resolve(null);
        }
      });
    });
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    let coords = await getGpsFromExif(file);

    if (!coords) {
      try {
        coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              });
            },
            (err) => reject(err)
          );
        });
      } catch (error) {
        alert("無法取得 GPS 位置，請開啟定位權限");
        setUploading(false);
        return;
      }
    }

    // 這裡直接上傳 Firestore（可改成你的上傳 API）
    await addDoc(collection(db, "images"), {
      lat: coords.lat,
      lng: coords.lng,
      timestamp: new Date().toISOString()
    });

    await loadMarkers();
    setUploading(false);
  }

  return (
    <div>
      <h1>TrashMap</h1>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
      />
      {uploading && <p>上傳中...</p>}

      <MapContainer
        center={[23.7, 120.43]}
        zoom={11}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]}>
            <Popup>
              {m.timestamp}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;
