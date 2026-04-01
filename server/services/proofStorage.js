const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function getUploadsDir() {
  return path.join(__dirname, "../../public/uploads/proofs");
}

function ensureUploadsDir() {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function makeLocalFilename(originalname = "") {
  const ext = path.extname(originalname) || "";
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

async function saveProofLocally(file) {
  const dir = ensureUploadsDir();
  const filename = makeLocalFilename(file.originalname);
  const absolutePath = path.join(dir, filename);
  await fs.promises.writeFile(absolutePath, file.buffer);
  return filename;
}

function buildCloudinarySignature(params, apiSecret) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(`${sorted}${apiSecret}`).digest("hex");
}

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadProofToCloudinary(file) {
  const folder = process.env.CLOUDINARY_PROOF_FOLDER || "bihal-suppliers/maintenance-proofs";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto", // auto-detects images, pdfs, etc.
        type: "upload",        // ensures public delivery (not authenticated)
        access_mode: "public", // explicitly mark as publicly accessible
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

async function storeProofDocument(file) {
  if (!file) return null;
  if (isCloudinaryConfigured()) {
    console.log('[proofStorage] Uploading to Cloudinary...');
    return uploadProofToCloudinary(file);
  }
  console.warn('[proofStorage] WARNING: Cloudinary not configured — saving file to LOCAL disk. Files will be lost on Render restart! Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in Render environment variables.');
  return saveProofLocally(file);
}

// Log Cloudinary status on startup
if (isCloudinaryConfigured()) {
  console.log('[proofStorage] Cloudinary configured. Proof documents will be stored in cloud.');
} else {
  console.warn('[proofStorage] STARTUP WARNING: Cloudinary NOT configured. Proof documents will only be stored locally and will be lost on Render restart!');
}

module.exports = {
  isCloudinaryConfigured,
  storeProofDocument,
};
