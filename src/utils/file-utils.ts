import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);

export async function writeFile(filePath: string, data: any): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  await writeFileAsync(filePath, content, 'utf-8');
}
