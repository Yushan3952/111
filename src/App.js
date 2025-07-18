import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { initializeApp } from 'firebase/app';

// 你的 Firebase config，請換成你自己的
const firebaseConfig = {
  apiKey: "你的APIKEY",
  authDomain: "你的AUTH_DOMAIN",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "你的MSG_SENDER_ID",
  appId: "你的APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Leaflet marker icon fix for default icon not showing properly
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
});

function LocationMarker({ onLocationSelect }) {
  const [position, setPosition] = useState(null);
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationSelect(e.latlng);
    },
  });
  return position === null ? null : (
    <Marker position={position}>
      <Popup>選擇這裡作為垃圾位置</Popup>
    </Marker>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedPos, setSelectedPos] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    onAuthStateChanged(auth, (usr) => {
      setUser(usr);
    });

    // 監聽 firestore 垃圾標記資料
    const q = query(collection(db, 'trashmarks'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setMarkers(items);
    });
    return () => unsubscribe();
  }, []);

  async function handleLogin() {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert('登入失敗: ' + error.message);
    }
  }

  function handleLogout() {
    signOut(auth);
  }

  async function handleUpload() {
    if (!selectedPos) {
      alert('請先在地圖點擊選擇垃圾位置');
      return;
    }
    const file = fileInputRef.current.files[0];
    if (!file) {
      alert('請選擇照片');
      return;
    }
    setUploading(true);
    try {
      const fileRef = storageRef(storage, `trashphotos/${user.uid}_${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await addDoc(collection(db, 'trashmarks'), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        timestamp: new Date(),
        location: {
          lat: selectedPos.lat,
          lng: selectedPos.lng,
        },
        imageUrl: url,
      });

      alert('上傳成功！');
      fileInputRef.current.value = '';
      setSelectedPos(null);
    } catch (error) {
      alert('上傳失敗: ' + error.message);
    }
    setUploading(false);
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 10 }}>
      <h1>全民科學垃圾熱點回報</h1>
      {user ? (
        <>
          <div style={{ marginBottom: 10 }}>
            歡迎，{user.displayName}！{' '}
            <button onClick={handleLogout}>登出</button>
          </div>
          <MapContainer
            center={[23.7, 120.5]} // 雲林縣中心
            zoom={10}
            style={{ height: '500px', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker onLocationSelect={setSelectedPos} />
            {markers.map((mark) => (
              <Marker key={mark.id} position={[mark.location.lat, mark.location.lng]}>
                <Popup>
                  <div>
                    <strong>{mark.displayName}</strong> <br />
                    {new Date(mark.timestamp.seconds * 1000).toLocaleString()} <br />
                    <img
                      src={mark.imageUrl}
                      alt="垃圾照片"
                      style={{ width: '100px', height: 'auto', marginTop: 5 }}
                    />
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div style={{ marginTop: 10 }}>
            <p>點擊地圖選擇垃圾位置</p>
            <input type="file" accept="image/*" ref={fileInputRef} />
            <br />
            <button onClick={handleUpload} disabled={uploading}>
              {uploading ? '上傳中...' : '上傳照片'}
            </button>
          </div>
        </>
      ) : (
        <button onClick={handleLogin}>使用 Google 登入</button>
      )}
    </div>
  );
}
