import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import imageCompression from 'browser-image-compression';

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

// Leaflet 標記圖示修正
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
  const [uploadProgress, setUploadProgress] = useState(0);

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
      alert('請先點擊地圖標記上傳位置');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      // 壓縮圖片
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      // 上傳到 Cloudinary
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/upload`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
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
      setImages(prev => [...prev, newImage]);
      alert('上傳成功！');
      setFile(null);
      setSelectedPosition(null);
    } catch (err) {
      console.error('上傳失敗:', err);
      alert('上傳失敗');
    } finally {
      setUploading(false);
      setUploadProgress(0);
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

        {uploading && (
          <div style={{ marginTop: '8px' }}>
            <p>上傳進度：{uploadProgress}%</p>
            <div style={{ width: '100%', background: '#eee' }}>
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: '10px',
                  background: '#4caf50',
                  transition: 'width 0.3s'
                }}
              />
            </div>
          </div>
        )}

        <p>請先點擊地圖標記上傳位置，再選擇圖片並點擊上傳</p>
      </div>
    </div>
  );
}
