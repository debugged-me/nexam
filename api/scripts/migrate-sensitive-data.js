import fs from 'fs/promises';
import pool from '../src/config/db.js';
import {
  blindIndex,
  encryptFileAtRest,
  isProtectedText,
  protectText,
  unprotectText,
} from '../src/services/storageCrypto.js';

let studentsUpdated = 0;
const [students] = await pool.query(
  `SELECT id, student_number, full_name FROM students`
);
for (const student of students) {
  const number = unprotectText(student.student_number);
  const name = unprotectText(student.full_name) || 'Unknown';
  await pool.query(
    `UPDATE students
     SET student_number = :number,
         student_number_hash = :numberHash,
         full_name = :name,
         full_name_hash = :nameHash
     WHERE id = :id`,
    {
      id: student.id,
      number: number ? protectText(number) : null,
      numberHash: blindIndex(number),
      name: protectText(name),
      nameHash: blindIndex(name),
    }
  );
  if (!isProtectedText(student.full_name) || (student.student_number && !isProtectedText(student.student_number))) {
    studentsUpdated++;
  }
}

let scansUpdated = 0;
const [scans] = await pool.query(`SELECT id, student_name FROM scan_results WHERE student_name IS NOT NULL`);
for (const scan of scans) {
  if (isProtectedText(scan.student_name)) continue;
  await pool.query(
    `UPDATE scan_results SET student_name = :name WHERE id = :id`,
    { id: scan.id, name: protectText(scan.student_name) }
  );
  scansUpdated++;
}

let filesEncrypted = 0;
const [materials] = await pool.query(`SELECT file_path FROM materials WHERE file_path IS NOT NULL`);
for (const material of materials) {
  try {
    await fs.access(material.file_path);
    if (await encryptFileAtRest(material.file_path)) filesEncrypted++;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

console.log(JSON.stringify({ studentsUpdated, scansUpdated, filesEncrypted }));
await pool.end();
