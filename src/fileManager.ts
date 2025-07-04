import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');

// Ensure the uploads directory exists
async function ensureUploadsDir() {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
}

// Upload a file (write buffer to disk)
export async function uploadFile(filename: string, data: Buffer) {
  await ensureUploadsDir();
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, data);
  return filePath;
}

// Read a file
export async function readFile(filename: string) {
  const filePath = path.join(uploadsDir, filename);
  return await fs.readFile(filePath);
}

// Delete a file
export async function deleteFile(filename: string) {
  const filePath = path.join(uploadsDir, filename);
  await fs.unlink(filePath);
} 