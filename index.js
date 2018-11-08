/* eslint-disable no-console */
import find from 'find';
import yargs from 'yargs';

import { lstat } from './src/util';
import RustInstrumenter from './src/rust-instrumenter';
import CppInstrumenter from './src/cpp-instrumenter';

const CPP_RE = /\.(h|hpp|cpp)$/;
const RUST_RE = /\.(rs)$/;

const { argv } = yargs
  .option('path', {
    demandOption: true,
    describe: 'Path the root directory or file to instrument',
    type: 'string',
  })
  .option('exclude', {
    alias: 'skip',
    describe: 'Regex to exclude files',
    type: 'string',
  })
  .option('dry', {
    describe: 'Dry run',
    type: 'boolean',
  })
  .option('silent', {
    describe: 'Silent output',
    type: 'boolean',
    conflicts: 'verbose',
  })
  .option('verbose', {
    describe: 'Verbose output',
    type: 'boolean',
    conflicts: 'silent',
  })
  .demandOption(['path']);

const run = async (file, options) => {
  const exclude = new RegExp(options.exclude);

  if (file.match(CPP_RE)) {
    if (argv.exclude && file.match(exclude)) {
      if (!options.silent) {
        console.info('Skipping', file);
      }
    } else {
      if (!options.silent) {
        console.info('Found', file);
      }
      const cpp = new CppInstrumenter();
      const altered = await cpp.instrument(file, { overwrite: !options.dry });
      if (!options.silent) {
        console.info('Instrumented', file);
      }
      if (options.verbose) {
        console.info(altered);
      }
    }
  } else if (file.match(RUST_RE)) {
    if (argv.exclude && file.match(exclude)) {
      if (!options.silent) {
        console.info('Skipping', file);
      }
    } else {
      if (!options.silent) {
        console.info('Found', file);
      }
      const rs = new RustInstrumenter();
      const altered = await rs.instrument(file, { overwrite: !options.dry });
      if (!options.silent) {
        console.info('Instrumented', file);
      }
      if (options.verbose) {
        console.info(altered);
      }
    }
  }
};

const main = async () => {
  const stat = await lstat(argv.path);
  if (stat.isFile()) {
    run(argv.path, argv);
  } else {
    find.eachfile(argv.path, file => run(file, argv));
  }
};

main();
