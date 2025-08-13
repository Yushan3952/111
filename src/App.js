// src/App.js
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import EXIF from 'exif-js';
import 'leaflet/dist/leaflet.css';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';
import axios from 'axios';

// Firebase 設定（換成你的）
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

// 地圖 icon 修正
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMarkers();
  }, []);

  const fetchMarkers = async () => {
    const querySnapshot = await getDocs(collection(db, 'images'));
    const data = querySnapshot.docs.map(doc => doc.data());
    setMarkers(data);
  };

  const getGpsFromExif = (file) => {
    return new Promise((resolve) => {
      EXIF.getData(file, function () {
        const lat = EXIF.getTag(this, 'GPSLatitude');
        const lon = EXIF.getTag(this, 'GPSLongitude');
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef') || 'N';
        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef') || 'E';
        const dateTimeOriginal = EXIF.getTag(this, 'DateTimeOriginal');

        if (lat && lon) {
          const toDecimal = (gpsData, ref) => {
            const d = gpsData[0];
            const m = gpsData[1];
            const s = gpsData[2];
            let dec = d + m / 60 + s / 3600;
            if (ref === 'S' || ref === 'W') dec = dec * -1;
            return dec;
          };
          resolve({
            latitude: toDecimal(lat, latRef),
            longitude: toDecimal(lon, lonRef),
            timestamp: dateTimeOriginal || new Date().toISOString()
          });
        } else {
          resolve(null);
        }
      });
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    // 先試讀 EXIF GPS
    let locationData = await getGpsFromExif(file);

    // 如果沒有 GPS → 用即時定位
    if (!locationData) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        locationData = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: new Date().toISOString()
        };
      } catch (err) {
        alert('無法取得定位');
        setUploading(false);
        return;
      }
    }

    // 上傳圖片到 Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'trashmap_unsigned'); // 換成你的
    const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload`, formData);

    // 存到 Firestore
    await addDoc(collection(db, 'images'), {
      url: uploadRes.data.secure_url,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timestamp: locationData.timestamp
    });

    setUploading(false);
    fetchMarkers();
    e.target.value = ''; // 重置 input
  };

  return (
    <div>
      <h1>TrashMap</h1>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      {uploading && <p>上傳中...</p>}
      <MapContainer center={[23.7, 120.43]} zoom={11} style={{ height: '80vh', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.latitude, m.longitude]}>
            <Popup>
              <img src={m.url} alt="uploaded" style={{ width: '100px' }} />
              <br />
              {m.timestamp}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
