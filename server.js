const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================== IN-MEMORY DATABASE ==================
let complaints = [];

// ================== DEPARTMENTS ==================
const departments = {
    "Water Leakage": {
        folder: "water_department",
        name: "Water Department"
    },
    "Damaged Roads": {
        folder: "construction_department",
        name: "Construction Department"
    },
    "Street Light Issue": {
        folder: "electricity_department",
        name: "Electricity Department"
    },
    "Garbage": {
        folder: "sanitation_department",
        name: "Sanitation Department"
    }
};

// ================== CREATE FOLDERS ==================
const uploadBase = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadBase)) {
    fs.mkdirSync(uploadBase, { recursive: true });
}

Object.values(departments).forEach(dep => {
    const folderPath = path.join(uploadBase, dep.folder);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
});

// ================== AI ANALYSIS ROUTE ==================
app.post('/api/analyze-image', (req, res) => {
    try {
        const { image, location } = req.body;

        if (!image) {
            return res.status(400).json({ error: "No image received" });
        }

        const gpsLocation = location
            ? JSON.parse(location)
            : {
                lat: 20.93,
                lng: 77.75,
                address: "Amravati, Maharashtra",
                accuracy: 50
            };

        // Remove base64 header
        const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Temporary file
        const tempFilename = `TEMP_${Date.now()}.jpg`;
        const tempPath = path.join(uploadBase, tempFilename);

        fs.writeFileSync(tempPath, imageBuffer);

        // Run Python AI
        exec(`python detect.py "${tempPath}"`, (error, stdout, stderr) => {

            if (error) {
                console.error("Python error:", error);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return res.status(500).json({ error: "AI detection failed" });
            }

            let result;

            try {
                result = JSON.parse(stdout);
            } catch (err) {
                console.error("Invalid JSON from AI:", stdout);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return res.status(500).json({ error: "Invalid AI response" });
            }

            const issueType = result.label;
            const confidence = result.confidence;

            const departmentData = departments[issueType] || {
                folder: "others",
                name: "General Department"
            };

            const departmentFolder = departmentData.folder;
            const departmentName = departmentData.name;

            const departmentPath = path.join(uploadBase, departmentFolder);
            if (!fs.existsSync(departmentPath)) {
                fs.mkdirSync(departmentPath, { recursive: true });
            }

            // Final file name
            const finalFilename = `NP_${Date.now()}.jpg`;
            const finalPath = path.join(departmentPath, finalFilename);

            fs.renameSync(tempPath, finalPath);

            const year = new Date().getFullYear();
            const complaintId = `NP-${year}-${Date.now().toString().slice(-4)}`;

            const complaint = {
                _id: Date.now().toString(),
                complaintId,
                issueType,
                confidence,
                department: departmentName,
                location: gpsLocation,
                imageFilename: `${departmentFolder}/${finalFilename}`,
                status: "open",
                submittedAt: new Date()
            };

            complaints.unshift(complaint);

            res.json({
                success: true,
                complaintId,
                issueType,
                confidence,
                department: departmentName
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ================== GET COMPLAINTS ==================
app.get('/api/complaints', (req, res) => {
    res.json(complaints);
});

// ================== ROOT CHECK ==================
app.get('/', (req, res) => {
    res.send("🚀 Nagar Parishad AI Server is Running");
});

// ================== START SERVER (RENDER FIX) ==================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
