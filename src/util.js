import { promisify } from 'util';
import fs from 'fs';
import cp from 'child_process';

export const lstat = promisify(fs.lstat);

export const read = promisify(fs.readFile);

export const write = promisify(fs.writeFile);

export const unlink = promisify(fs.unlink);

export const spawn = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = cp.spawn(command, args, options);
  let result = '';

  child.stdout.on('data', (data) => {
    result += data.toString();
  });
  child.on('error', (err) => {
    reject(err);
  });
  child.on('exit', () => {
    resolve(result);
  });
});
