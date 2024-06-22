const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Set up storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Serve static files from the "public" directory
app.use(express.static('public'));

// Route for uploading and processing the video
app.post('/upload', upload.single('video'), (req, res) => {
  const videoPath = req.file.path;
  const outputDir = 'outputs/';
  if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
  }

  // Get video duration and split it into segments
  ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) return res.status(500).send('Error processing video');
    
    const duration = metadata.format.duration;
    const segmentDuration = 240; // 4 minutes in seconds
    const segments = Math.ceil(duration / segmentDuration);

    for (let i = 0; i < segments; i++) {
      const start = i * segmentDuration;
      const outputFilename = `part_${i}_${path.basename(videoPath)}`;
      const outputPath = path.join(outputDir, outputFilename);

      ffmpeg(videoPath)
        .setStartTime(start)
        .setDuration(segmentDuration)
        .output(outputPath)
        .on('end', () => {
          console.log(`Segment ${i + 1} processed`);
          if (i === segments - 1) {
            res.send('Video uploaded and split successfully. <a href="/downloads">Download</a>');
          }
        })
        .on('error', (err) => {
          console.error(err);
          return res.status(500).send('Error processing video');
        })
        .run();
    }
  });
});

// Route to list and download split video files
app.get('/downloads', (req, res) => {
  fs.readdir('outputs/', (err, files) => {
    if (err) return res.status(500).send('Error reading output directory');

    let fileList = files.map(file => `<li><a href="/download/${file}">${file}</a></li>`).join('');
    res.send(`<ul>${fileList}</ul>`);
  });
});

// Route to download a specific file
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'outputs', req.params.filename);
  res.download(filePath);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
