import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn tới file service account (người dùng cần cung cấp file này)
const serviceAccountPath = path.join(
  __dirname,
  "../../firebase-service-account.json"
);

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("🔥 Firebase Admin initialized successfully");
} else {
  console.warn(
    "⚠️ Firebase Service Account file not found at:",
    serviceAccountPath
  );
  console.warn("⚠️ Push Notifications will not work until this file is added.");
}

export default admin;
