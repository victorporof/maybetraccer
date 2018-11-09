/* eslint-disable import/prefer-default-export */

import cp from 'child_process';

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
