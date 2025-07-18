import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { db, storage } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const customIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function App() {
  const [image, setImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [markers, setMarkers] = useState([]);

  useEffect(() => {
    // 取得使用者目前位置（可選）
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation([pos.coords.latitude, pos.coords.longitude]);
    });

    // 即時監聽 Firestore 中的照片標記
    const q = query(collection(db, "photos"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMarkers = snapshot.docs.map((doc) => doc.data());
      setMarkers(newMarkers);
    });

    return () => unsubscribe();
  }, []);

  const handleUpload = async () => {
    if (!image || !location) {
      alert("請選擇圖片並允許定位");
      return;
    }

    const imageRef = ref(storage, `photos/${Date.now()}.jpg`);
    await uploadBytes(imageRef, image);
    const url = await getDownloadURL(imageRef);

    await addDoc(collection(db, "photos"), {
      lat: location[0],
      lng: location[1],
      url,
      timestamp: Date.now(),
    });

    setImage(null);
    alert("上傳成功！");
  };

  return (
    <div>
      <h2>TrashMap - 拍照舉報垃圾</h2>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files[0])}
      />
      <button onClick={handleUpload}>上傳照片</button>

      <MapContainer
        center={[23.7, 120.4]} // 雲林中心位置
        zoom={10}
        style={{ height: "500px", width: "100%", marginTop: "20px" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />
        {markers.map((marker, index) => (
          <Marker
            key={index}
            position={[marker.lat, marker.lng]}
            icon={customIcon}
          >
            <Popup>
              <img
                src={marker.url}
                alt="uploaded"
                style={{ width: "150px" }}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;
