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
      resource_type: isImage ? "image" : "raw", // raw cho pdf, docx, zip...
      use_filename: true, // giữ nguyên tên file gốc
      unique_filename: false, // không random thêm chuỗi
      public_id: file.originalname, // giữ nguyên đuôi
    };
  },
});


export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
