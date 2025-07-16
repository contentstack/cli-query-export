import * as fs from 'fs';
import * as path from 'path';
import mkdirp from 'mkdirp';
import bigJSON from 'big-json';
import { FsUtility, sanitizePath } from '@contentstack/cli-utilities';

export const readFileSync = function (filePath: string, parse: boolean): unknown {
  let data;
  parse = typeof parse === 'undefined' ? true : parse;
  filePath = path.resolve(sanitizePath(filePath));
  if (fs.existsSync(filePath)) {
    data = parse ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : data;
  }
  return data;
};

// by default file type is json
export const readFile = async (filePath: string, options = { type: 'json' }): Promise<any> => {
  return new Promise((resolve, reject) => {
    filePath = path.resolve(sanitizePath(filePath));
    fs.readFile(filePath, 'utf-8', (error, data) => {
      if (error) {
        reject(error);
      } else {
        if (options.type !== 'json') {
          return resolve(data);
        }
        resolve(JSON.parse(data));
      }
    });
  });
};

export const writeFileSync = function (filePath: string, data: any): void {
  data = typeof data === 'object' ? JSON.stringify(data) : data || '{}';
  fs.writeFileSync(filePath, data);
};

export const writeFile = function (filePath: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    data = typeof data === 'object' ? JSON.stringify(data) : data || '{}';
    fs.writeFile(filePath, data, (error) => {
      if (error) {
        return reject(error);
      }
      resolve('done');
    });
  });
};

export const writeLargeFile = function (filePath: string, data: any): Promise<any> {
  if (typeof filePath !== 'string' || typeof data !== 'object') {
    return;
  }
  filePath = path.resolve(sanitizePath(filePath));
  return new Promise((resolve, reject) => {
    const stringifyStream = bigJSON.createStringifyStream({
      body: data,
    });
    let writeStream = fs.createWriteStream(filePath, 'utf-8');
    stringifyStream.pipe(writeStream);
    writeStream.on('finish', () => {
      resolve('');
    });
    writeStream.on('error', (error) => {
      reject(error);
    });
  });
};

export const makeDirectory = function (dir: string): void {
  for (const key in arguments) {
    const dirname = path.resolve(arguments[key]);
    if (!fs.existsSync(dirname)) {
      mkdirp.sync(dirname);
    }
  }
};

export const readdir = function (dirPath: string): any {
  if (fs.existsSync(dirPath)) {
    return fs.readdirSync(dirPath);
  } else {
    return [];
  }
};

exports.fileExistsSync = function (path: string) {
  return fs.existsSync(path);
};

export const fsUtil = new FsUtility();
