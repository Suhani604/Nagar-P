import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = "https://nagar-p-1.onrender.com/api";


function App() {
  const [complaints, setComplaints] = useState([]);
  const [message, setMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // 📍 GPS Location
  const getCurrentLocation = useCallback(() => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          address: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
        }),
        () => resolve({
          lat: 20.93,
          lng: 77.75,
          accuracy: 50,
          address: 'Amravati, MH'
        }),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  }, []);

  // 🎥 Enable Camera
  const enableCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        setCameraEnabled(true);
        setMessage("📷 Camera Ready");
      };

    } catch (err) {
      setMessage("❌ Camera permission denied.");
    }
  }, []);

  useEffect(() => {
    enableCamera();
  }, [enableCamera]);

  // 📸 Capture Image
  const captureAndAnalyze = async () => {
    if (!cameraEnabled) return;

    setIsAnalyzing(true);
    setMessage("📤 Image captured. Sending to AI...");

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = 1280;
      canvas.height = 720;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 1280, 720);

      const location = await getCurrentLocation();
      const imageData = canvas.toDataURL('image/jpeg', 0.95);

      await sendToAI(imageData, location);

    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }

    setIsAnalyzing(false);
  };

  // 📂 Upload Images
  const uploadAndAnalyze = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    setIsAnalyzing(true);
    setMessage("📤 Uploading image(s)...");

    try {
      const location = await getCurrentLocation();

      for (let file of files) {
        const reader = new FileReader();

        reader.onload = async (e) => {
          await sendToAI(e.target.result, location);
        };

        reader.readAsDataURL(file);
      }

    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }

    setIsAnalyzing(false);
  };

  // 🤖 Send to AI
  const sendToAI = async (imageData, location) => {
    try {
      setMessage("🤖 AI is analyzing image...");

      const response = await axios.post(`${API_BASE}/analyze-image`, {
        image: imageData,
        location: JSON.stringify(location)
      });

      const { issueType, confidence, complaintId, department } = response.data;

      setMessage(
      `✅ Complaint Registered Successfully!
      \n
      📌 Issue: ${issueType}
      \n
      🏢 Department: ${department}
      \n
      🆔 Complaint ID: ${complaintId}
      \n
      📊 Confidence: ${confidence}%`
      );

      fetchComplaints();

    } catch (error) {
      console.error(error);
      setMessage("❌ Server error. Please try again.");
    }
  };

  // 📋 Fetch Complaints
  const fetchComplaints = async () => {
    try {
      const res = await axios.get(`${API_BASE}/complaints`);
      setComplaints(res.data);
    } catch {}
  };

  useEffect(() => {
    const interval = setInterval(fetchComplaints, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="App">
      <h1>Smart Complaint Detector</h1>

      {/* 🎥 CAMERA */}
      <div className="camera-container">
        <video
          ref={videoRef}
          className="camera-view"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Capture Button */}
      <div className="capture-section">
        <button
          onClick={captureAndAnalyze}
          disabled={isAnalyzing || !cameraEnabled}
          className="capture-btn"
        >
          {isAnalyzing ? ' AI Scanning...' : '📸 CAPTURE DAMAGE'}
        </button>
      </div>

      {/* Upload Button */}
      <div className="upload-section">
        <label className="upload-btn">
          📂 Upload Image
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={uploadAndAnalyze}
            hidden
          />
        </label>
      </div>

      {message && <div className="message success">{message}</div>}

      {/* Complaints List */}
      {complaints.length > 0 && (
        <div className="complaints">
          <h2>Recent Complaints ({complaints.length})</h2>

          <div className="complaints-grid">
            {complaints.slice(0, 6).map((c) => (
              <div key={c._id} className="complaint-card">

                <div className="complaint-id">{c.complaintId}</div>

                <div className="complaint-type">
                  {c.issueType === 'roads' && 'Damaged Roads 🛣️'}
                  {c.issueType === 'garbage' && 'Garbage ♻️'}
                  {c.issueType === 'water_leakage' && 'Water Leakage 💧'}
                  {c.issueType === 'street_lights' && 'Street Light Issue 💡'}
                </div>

                <div>{c.location?.address}</div>

                <div>🏢 {c.department}</div>

                <span className={`status-badge status-${c.status}`}>
                  {c.status.toUpperCase()}
                </span>

                {c.imageFilename && (
                  <img
                    src={`http://localhost:5000/uploads/${c.imageFilename}`}
                    className="complaint-thumb"
                    alt="Complaint"
                  />
                )}

              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
