/* eslint-disable no-console */

import chalk from 'chalk';

export const info = (...args) => console.info(chalk.cyan(...args));

export const log = (...args) => console.log(...args);

export const warn = (...args) => console.warn(chalk.yellow(...args));

export const error = (...args) => console.error(chalk.red(...args));
