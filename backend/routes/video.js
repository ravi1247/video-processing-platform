const express = require('express');
const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const { authenticate, canEdit } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { processVideo } = require('../services/videoProcessor');

const router = express.Router();

// Upload video
router.post('/upload', authenticate, canEdit, upload.single('video'), handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    
    const { title, description, tags } = req.body;
    
    // Create video document
    const video = new Video({
      title: title || req.file.originalname,
      description: description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      userId: req.userId,
      status: 'processing',
      tags: tags ? JSON.parse(tags) : []
    });
    
    await video.save();
    
    // Start processing in background
    const io = req.app.get('io');
    processVideo(video._id, io);
    
    res.status(201).json({
      message: 'Video uploaded successfully',
      video: {
        id: video._id,
        title: video.title,
        status: video.status,
        filename: video.filename
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up file if upload fails
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get user's videos
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, sensitivityStatus, search, page = 1, limit = 20 } = req.query;
    
    // Build query - users only see their own videos
    const query = { userId: req.userId };
    
    if (status) {
      query.status = status;
    }
    
    if (sensitivityStatus) {
      query.sensitivityStatus = sensitivityStatus;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-filePath'); // Don't expose file path
    
    const total = await Video.countDocuments(query);
    
    res.json({
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get single video
router.get('/:id', authenticate, async (req, res) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ video });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Stream video
router.get('/:id/stream', authenticate, async (req, res) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    if (video.status !== 'completed') {
      return res.status(400).json({ error: 'Video is not ready for streaming' });
    }
    
    const videoPath = video.filePath;
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }
    
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      
      const headers = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': video.mimeType,
        'Cache-Control': 'no-cache'
      };
      
      res.writeHead(206, headers);
      file.pipe(res);
    } else {
      // No range, send entire file
      const headers = {
        'Content-Length': fileSize,
        'Content-Type': video.mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      };
      
      res.writeHead(200, headers);
      fs.createReadStream(videoPath).pipe(res);
    }
    
    // Increment view count (don't await to not block response)
    Video.findByIdAndUpdate(video._id, { $inc: { viewCount: 1 } }).exec();
    
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

// Delete video
router.delete('/:id', authenticate, canEdit, async (req, res) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Delete file
    fs.unlink(video.filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
    
    // Delete from database
    await Video.deleteOne({ _id: video._id });
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Update video metadata
router.put('/:id', authenticate, canEdit, async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    
    const video = await Video.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    if (title) video.title = title;
    if (description !== undefined) video.description = description;
    if (tags) video.tags = tags;
    
    await video.save();
    
    res.json({
      message: 'Video updated successfully',
      video
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

module.exports = router;