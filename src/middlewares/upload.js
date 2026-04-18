// middlewares/upload.js
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");
    return {
      folder: "chat_files",
      resource_type: isImage ? "image" : "raw",
      use_filename: true,
      unique_filename: false,
      public_id: file.originalname,
    };
  },
});

// Separate storage for user avatars
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "avatars",
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", quality: "auto" },
    ],
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});
