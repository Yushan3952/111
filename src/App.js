import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

// Leaflet 修正圖示問題
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
});

// Firebase 設定（請勿修改）
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

// 讓使用者點地圖取座標
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

  // 初次載入時從 Firebase 取得全部圖片
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
    if (!file) {
      alert('請先選擇圖片');
      return;
    }
    if (!selectedPosition) {
      alert('請先點擊地圖選擇位置');
      return;
    }
    setUploading(true);
    setProgress(0);

    try {
      // 圖片壓縮
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1200, useWebWorker: true };
      const compressedFile = await window.imageCompression(file, options);

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

      // 上傳到 Cloudinary
      const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
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
      alert('圖片上傳失敗：' + (err?.response?.data?.error?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '10px' }}>
      <h1>全民科學垃圾熱點回報</h1>

      <MapContainer
        center={[23.7, 120.4]}
        zoom={9}
        style={{ height: '500px', width: '100%' }}
      >
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
            <Popup>你選擇的位置</Popup>
          </Marker>
        )}
      </MapContainer>

      <div style={{ marginTop: '10px' }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? '上傳中...' : '上傳垃圾照片'}
        </button>
        {uploading && (
          <div style={{ marginTop: '10px' }}>
            <div
              style={{
                width: '100%',
                backgroundColor: '#ccc',
                borderRadius: '4px',
                height: '10px',
                marginBottom: '5px'
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  backgroundColor: '#4caf50',
                  height: '100%',
                  borderRadius: '4px',
                  transition: 'width 0.3s'
                }}
              />
            </div>
            <div style={{ fontSize: '12px' }}>{progress}%</div>
          </div>
        )}
        <p>請先點擊地圖標記位置，再選擇照片上傳</p>
      </div>
    </div>
  );
}
