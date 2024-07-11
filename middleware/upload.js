const multer = require('multer');
const ImageKit = require('imagekit');
require('dotenv').config();

console.log('Initializing ImageKit...');

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

console.log('Initialized ImageKit', imagekit);

// Configure Multer to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB size limit
  fileFilter: (req, file, cb) => {
    checkFileTypeAndSize(file, cb);
  },
}).single('route_image'); // Make sure this matches the key used in the form data

console.log('Initialized Multer');

// Check file type and size
function checkFileTypeAndSize(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif/;
  // Check ext
  const extname = filetypes.test(file.originalname.toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    console.log('File type and size valid');
    cb(null, true);
  } else {
    console.log('Invalid file type or size');
    cb('Error: Images Only!');
  }
}

const uploadImageToImageKit = async (req, res, next) => {
  if (!req.file) {
    console.log('No file uploaded');
    return res.status(400).json({ error: 'Image file is required' });
  }

  console.log('File uploaded successfully');

  // File size validation
  if (req.file.size > 1 * 1024 * 1024) { // 1MB limit
    console.log('File size exceeds limit');
    return res.status(400).json({ error: 'File size exceeds 1MB limit' });
  }

  try {
    const result = await imagekit.upload({
      file: req.file.buffer, // required
      fileName: req.file.originalname, // required
    });

    req.file.url = result.url;
    console.log('Image uploaded to ImageKit successfully');
    next();
  } catch (error) {
    console.log('Error uploading image to ImageKit', error);
    res.status(500).json({ error: error.message });
  }
};

console.log('Modules initialized');

module.exports = { upload, uploadImageToImageKit };
