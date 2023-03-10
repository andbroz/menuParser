import fs from 'node:fs/promises';

export async function readFile(filePath: string) {
  const data = await fs.readFile(filePath, { encoding: 'utf-8' });
  return data.split('\r\n');
}

export async function saveFile(path: string, data: string) {
  try {
    await fs.writeFile(path, data);
  } catch (err) {
    console.error(err);
  }
}

export async function isExistingFile(path: string) {
  if (path.length === 0) {
    return false;
  }

  try {
    const stat = await fs.stat(path);

    if (stat.isFile()) {
      return true;
    }
  } catch (err) {
    return false;
  }

  return false;
}
