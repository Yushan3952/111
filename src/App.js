import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

// Leaflet marker icon 修復
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
});

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyDuqJXExGztRz1lKsfvPiZTjL2VN9v9_yo",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "1057540241087",
  appId: "1:1057540241087:web:ca7a8f3870cfb9fcd5a6c4"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function LocationMarker({ setSelectedPosition }) {
  useMapEvents({
    click(e) {
      setSelectedPosition(e.latlng);
    },
  });
  return null;
}

export default function App() {
  const [images, setImages] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'images'));
        const docs = snapshot.docs.map(doc => doc.data());
        setImages(docs);
      } catch (err) {
        console.error('讀取 Firestore 失敗:', err);
      }
    };
    fetchImages();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert('請先選擇圖片');
    if (!selectedPosition) return alert('請先點擊地圖標記上傳位置');

    setUploading(true);
    setProgress(0);

    try {
      // 圖片壓縮
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };
      const compressedFile = await window.imageCompression(file, options);

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/upload`,
        formData,
        {
          onUploadProgress: (e) => {
            const percent = Math.round((e.loaded * 100) / e.total);
            setProgress(percent);
          }
        }
      );

      const newImage = {
        url: res.data.secure_url,
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        timestamp: new Date().toISOString(),
        publicId: res.data.public_id,
      };
      await addDoc(collection(db, 'images'), newImage);
      setImages((prev) => [...prev, newImage]);

      alert('上傳成功！');
      setFile(null);
      setSelectedPosition(null);
      setProgress(0);
    } catch (err) {
      console.error('上傳失敗:', err);
      alert('上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '10px' }}>
      <h1>全民科學垃圾熱點回報</h1>

      <MapContainer center={[23.7, 120.4]} zoom={9} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <LocationMarker setSelectedPosition={setSelectedPosition} />

        {images.map((img, idx) => (
          <Marker key={idx} position={[img.lat, img.lng]}>
            <Popup>
              <div>
                <img src={img.url} alt="垃圾照片" style={{ width: '200px' }} />
                <br />
                <small>上傳時間: {new Date(img.timestamp).toLocaleString()}</small>
              </div>
            </Popup>
          </Marker>
        ))}

        {selectedPosition && (
          <Marker position={[selectedPosition.lat, selectedPosition.lng]}>
            <Popup>上傳位置</Popup>
          </Marker>
        )}
      </MapContainer>

      <div style={{ marginTop: '10px' }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? '上傳中...' : '上傳垃圾照片'}
        </button>
        <p>請先點擊地圖標記上傳位置，再選擇圖片並點擊上傳</p>

        {uploading && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ width: '100%', backgroundColor: '#eee', height: '20px' }}>
              <div
                style={{
                  width: `${progress}%`,
                  backgroundColor: '#4caf50',
                  height: '100%',
                  transition: 'width 0.2s',
                }}
              />
            </div>
            <p>{progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
}
