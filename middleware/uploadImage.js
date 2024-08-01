const multer = require('multer');
const ImageKit = require('imagekit');
require('dotenv').config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const createUploadMiddleware = (fieldName) => {
  const storage = multer.memoryStorage();
  return multer({
    storage,
    limits: { fileSize: 1 * 1024 * 1024 }, // 1MB size limit
    fileFilter: (req, file, cb) => {
      checkFileTypeAndSize(file, cb);
    },
  }).single(fieldName);
};

function checkFileTypeAndSize(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(file.originalname.toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

const uploadImageToImageKit = async (req, res, next) => {
  if (!req.file) {
    return next(); // If no file is uploaded, proceed to the next middleware
  }

  if (req.file.size > 1 * 1024 * 1024) { // 1MB limit
    return res.status(400).json({ error: 'File size exceeds 1MB limit' });
  }

  try {
    const result = await imagekit.upload({
      file: req.file.buffer,
      fileName: req.file.originalname,
    });

    req.file.url = result.url;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createUploadMiddleware, uploadImageToImageKit };
