const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Artifact = require('../models/Artifact'); // Our higher-level Artifact model
const fs = require('fs/promises'); // For error cleanup

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the uploads directory exists
    const uploadDir = path.join(__dirname, '../uploads');
    fs.mkdir(uploadDir, { recursive: true }).then(() => {
      cb(null, uploadDir);
    }).catch(err => {
      console.error('Error creating upload directory:', err);
      cb(err);
    });
  },
  filename: (req, file, cb) => {
    // Generate a unique filename: fieldname-timestamp.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer upload middleware
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    // Basic file type validation (e.g., images, documents, common media)
    const allowedMimeTypes = [
      'text/plain',
      'image/png',
      'application/pdf',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only .txt, .png, and .pdf are allowed!'));
  }
});

// POST /api/artifacts - Create a new artifact with file upload
router.post('/', upload.single('artifactFile'), async (req, res) => {
  try {
    const { name, type, userId, tags } = req.body;
    const tagNames = tags ? JSON.parse(tags) : []; // Frontend might send tags as a JSON string

    // Validate required fields explicitly here, in case Multer passes
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    if (!name || !type || !userId) {
      // Clean up the uploaded file if validation fails here
      await fs.unlink(req.file.path).catch(err => console.error(`Error deleting temp file: ${err.message}`));
      return res.status(400).json({ message: 'Name, type, and userId are required.' });
    }

    const newArtifact = await Artifact.create(
      { name, type, userId: parseInt(userId), tagNames },
      req.file
    );

    res.status(201).json({ message: 'Artifact created successfully', artifact: newArtifact });
  } catch (error) {
    console.error('Error creating artifact:', error);
    // If an error occurred during artifact creation (e.g., DB error after file upload),
    // the file cleanup is handled within Artifact.create.
    // However, if an error happens before calling Artifact.create (e.g., Multer error),
    // req.file might still exist and needs cleanup.
    if (req.file) {
        await fs.unlink(req.file.path).catch(err => console.error(`Error deleting orphaned file: ${err.message}`));
    }
    res.status(500).json({ message: error.message || 'Failed to create artifact.' });
  }
});

// GET /api/artifacts/:id/content - Stream artifact file content
router.get('/:id/content', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'A valid artifact ID is required.' });
    }

    const artifact = await Artifact.findArtifactById(parseInt(id));

    if (!artifact) {
      return res.status(404).json({ message: 'Artifact not found.' });
    }

    const filePath = artifact.filePath;
    const fileMimeType = artifact.fileMimeType;

    if (!filePath || !fileMimeType) {
      return res.status(500).json({ message: 'File path or MIME type not available for this artifact.' });
    }

    // Stream the file to the response
    res.setHeader('Content-Type', fileMimeType);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        return res.status(500).json({ message: 'Error sending file.' });
      }
    });

  } catch (error) {
    console.error('Error retrieving artifact content:', error);
    res.status(500).json({ message: error.message || 'Failed to retrieve artifact content.' });
  }
});


// GET /api/artifacts/user/:userId - List a specific user's artifacts
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: 'A valid userId is required.' });
    }

    const artifacts = await Artifact.findArtifactsByUserId(parseInt(userId));

    if (artifacts.length === 0) {
      return res.status(404).json({ message: 'No artifacts found for this user.' });
    }

    res.status(200).json({ artifacts });
  } catch (error) {
    console.error('Error listing artifacts for user:', error);
    res.status(500).json({ message: error.message || 'Failed to retrieve artifacts.' });
  }
});

// PUT /api/artifacts/:id - Update an existing artifact
router.put('/:id', upload.single('artifactFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, userId, tags } = req.body;
    const tagNames = tags ? JSON.parse(tags) : undefined; // Use undefined if no tags are sent, to avoid accidental empty array

    if (!id || isNaN(parseInt(id))) {
      // Clean up newly uploaded file if ID is invalid
      if (req.file) {
        await fs.unlink(req.file.path).catch(err => console.error(`Error deleting temp file for invalid ID: ${err.message}`));
      }
      return res.status(400).json({ message: 'A valid artifact ID is required.' });
    }

    const artifactData = {
      name: name !== undefined ? name : undefined,
      type: type !== undefined ? type : undefined,
      userId: userId !== undefined ? parseInt(userId) : undefined,
      tagNames: tagNames,
    };

    // Filter out undefined values to only update provided fields
    Object.keys(artifactData).forEach(key => artifactData[key] === undefined && delete artifactData[key]);

    const updatedArtifact = await Artifact.update(parseInt(id), artifactData, req.file);

    if (!updatedArtifact) {
      return res.status(404).json({ message: 'Artifact not found.' });
    }

    res.status(200).json({ message: 'Artifact updated successfully', artifact: updatedArtifact });
  } catch (error) {
    console.error('Error updating artifact:', error);
    // If an error occurred during artifact update (e.g., DB error after file upload),\
    // the file cleanup is handled within Artifact.update.\
    // However, if an error happens before calling Artifact.update (e.g., Multer error),\
    // req.file might still exist and needs cleanup.
    if (req.file) {
      await fs.unlink(req.file.path).catch(err => console.error(`Error deleting orphaned file on update error: ${err.message}`));
    }
    res.status(500).json({ message: error.message || 'Failed to update artifact.' });
  }
});

// DELETE /api/artifacts/:id - Delete an artifact
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'A valid artifact ID is required.' });
    }

    const deletedArtifact = await Artifact.delete(parseInt(id));

    if (!deletedArtifact) {
      return res.status(404).json({ message: 'Artifact not found.' });
    }

    res.status(200).json({ message: 'Artifact deleted successfully', id: deletedArtifact.id });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    res.status(500).json({ message: error.message || 'Failed to delete artifact.' });
  }
});

module.exports = router;
