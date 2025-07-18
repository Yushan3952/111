iimport React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot } from "firebase/firestore";

// Firebase config (請換成你自己的)
const firebaseConfig = {
  apiKey: "AIzaSyAeX-tc-Rlr08KU8tPYZ4QcXDFdAx3LYHI",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "527164483024",
  appId: "1:527164483024:web:a40043feb0e05672c085d5",
  measurementId: "G-MFJDX8XJML"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

delete L.Icon.Default.prototype._getIconUrl; // 重置 Leaflet icon
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
});

function LocationMarker() {
  const [position, setPosition] = useState(null);
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      // 新增標記到 Firestore
      addDoc(collection(db, "markers"), {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        timestamp: Date.now(),
      });
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>新增垃圾熱點</Popup>
    </Marker>
  );
}

function App() {
  const [markers, setMarkers] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "markers"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMarkers(data);
    });
    return () => unsub();
  }, []);

  return (
    <div style={{ height: '100vh' }}>
      <h1 style={{ textAlign: 'center' }}>全民科學垃圾熱點回報</h1>
      <MapContainer
        center={[23.7, 120.4]} // 雲林縣中心點（含濁水溪、北港溪附近）
        zoom={10}
        style={{ height: '90%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map(marker => (
          <Marker key={marker.id} position={[marker.lat, marker.lng]}>
            <Popup>垃圾熱點回報於 {new Date(marker.timestamp).toLocaleString()}</Popup>
          </Marker>
        ))}
        <LocationMarker />
      </MapContainer>
      <p style={{ textAlign: 'center' }}>
        點擊地圖新增垃圾熱點（無需登入）
      </p>
    </div>
  );
}

export default App;
