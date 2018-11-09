import find from 'find';
import yargs from 'yargs';

import * as logging from './src/util-logging';
import { lstat } from './src/util-fs';
import RustInstrumenter from './src/rust-instrumenter';
import CppInstrumenter from './src/cpp-instrumenter';

const CPP_RE = /\.(h|hpp|cpp)$/;
const RUST_RE = /\.(rs)$/;

const { argv } = yargs
  .option('clang', {
    demandOption: true,
    describe: 'Path for clang-check',
    type: 'string',
    default: '/usr/local/opt/llvm/bin/clang-check',
  })
  .option('path', {
    demandOption: true,
    describe: 'Path to the directory or file to instrument',
    type: 'string',
  })
  .option('rel', {
    describe: 'Path to a root directory to relate paths to',
    type: 'string',
    default: '/',
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
        logging.info('Skipping', file);
      }
    } else {
      if (!options.silent) {
        logging.info('Found', file);
      }
      try {
        const cpp = new CppInstrumenter(options);
        const altered = await cpp.instrument(file, { overwrite: !options.dry });
        if (!options.silent) {
          logging.info('Instrumented', file);
        }
        if (options.verbose) {
          logging.log(altered);
        }
      } catch (e) {
        logging.error('Failed', file);
        logging.error(e);
      }
    }
  } else if (file.match(RUST_RE)) {
    if (argv.exclude && file.match(exclude)) {
      if (!options.silent) {
        logging.info('Skipping', file);
      }
    } else {
      if (!options.silent) {
        logging.info('Found', file);
      }
      try {
        const rs = new RustInstrumenter(options);
        const altered = await rs.instrument(file, { overwrite: !options.dry });
        if (!options.silent) {
          logging.info('Instrumented', file);
        }
        if (options.verbose) {
          logging.log(altered);
        }
      } catch (e) {
        logging.error('Failed', file);
        logging.error(e);
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
