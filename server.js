const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let complaints = [];

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.post('/api/analyze-image', (req, res) => {
  try {
    const { image, location } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image received' });
    }

    const gpsLocation = location
      ? JSON.parse(location)
      : { lat: 20.93, lng: 77.75, address: 'Amravati', accuracy: 50 };

    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const filename = `AI_${Date.now()}.jpg`;
    const filePath = path.join(__dirname, 'uploads', filename);

    fs.writeFileSync(filePath, imageBuffer);

    const year = new Date().getFullYear();
    const count = complaints.filter(c => c.complaintId?.includes(`NP-${year}`)).length;
    const complaintId = `NP-${year}-${String(count + 1).padStart(4, '0')}`;

    // CALL PYTHON MODEL
    exec(`python detect.py "${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error("Python error:", error);
        return res.status(5000).json({ error: "AI processing failed" });
      }

      try {
        const result = JSON.parse(stdout);

        const issueType = result.label;
        const confidence = result.confidence;

        const complaint = {
          _id: Date.now().toString(),
          complaintId,
          senderName: 'AI Citizen',
          location: gpsLocation,
          description: `AI Auto-detected: ${issueType}`,
          issueType,
          confidence,
          imageFilename: filename,
          status: 'open',
          submittedAt: new Date(),
          department:
            issueType === "Damaged Roads"
              ? "Construction Dept"
              : issueType === "Water Leakage"
              ? "Water Dept"
              : "Sanitation Dept"
        };

        complaints.unshift(complaint);

        res.json({
          success: true,
          complaintId,
          issueType,
          confidence,
          department: complaint.department
        });

      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        res.status(500).json({ error: "Invalid AI response" });
      }
    });

  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/complaints', (req, res) => {
  res.json(complaints);
});

app.listen(5000, () => {
  console.log('AI Server → http://localhost:5000');
});
