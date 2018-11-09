import { promisify } from 'util';
import fs from 'fs';

export const lstat = promisify(fs.lstat);

export const read = promisify(fs.readFile);

export const write = promisify(fs.writeFile);

export const unlink = promisify(fs.unlink);
