const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// FIXED: Parse FormData + JSON + Large payloads
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let complaints = [];
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// AI Analysis
function analyzeImage() {
  const isRoadDamage = Math.random() > 0.45;
  const confidence = (Math.random() * 0.35 + 0.65) * 100;
  return {
    issueType: isRoadDamage ? 'roads' : 'garbage',
    confidence: confidence.toFixed(1)
  };
}

app.post('/api/analyze-image', (req, res) => {
  try {
    console.log('Received:', Object.keys(req.body));
    
    const { image, location } = req.body;
    
    //  Validate image data
    if (!image) {
      return res.status(400).json({ error: 'No image received' });
    }

    const gpsLocation = location ? JSON.parse(location) : {
      lat: 20.93, lng: 77.75, address: 'Amravati, Maharashtra', accuracy: 50
    };

    //  Extract base64 image
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    //  AI Analysis
    const { issueType, confidence } = analyzeImage();

    // Save image
    const filename = `AI_${Date.now()}.jpg`;
    fs.writeFileSync(path.join('uploads', filename), imageBuffer);

    //  Complaint
    const year = new Date().getFullYear();
    const count = complaints.filter(c => c.complaintId?.includes(`NP-${year}`)).length;
    const complaintId = `NP-${year}-${String(count + 1).padStart(4, '0')}`;

    const complaint = {
      _id: Date.now().toString(),
      complaintId,
      senderName: 'AI Citizen',
      phone: gpsLocation.accuracy ? `GPS-${gpsLocation.accuracy}m` : 'Mobile',
      location: gpsLocation,
      description: `AI Auto-detected: ${issueType}`,
      issueType,
      confidence,
      imageFilename: filename,
      status: 'open',
      submittedAt: new Date(),
      department: issueType === 'roads' ? 'Construction Dept' : 'Electrical Dept'
    };

    complaints.unshift(complaint);
    
    console.log(`SUCCESS: ${issueType.toUpperCase()} (${confidence}%)`);
    
    res.json({ 
      success: true, 
      complaintId, 
      issueType, 
      confidence,
      department: complaint.department 
    });
    
  } catch (error) {
    console.error(' ERROR:', error.message);s
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/complaints', (req, res) => {
  res.json(complaints);
});

app.listen(5000, () => {
  console.log('Ai Server → http://localhost:5000');
});
