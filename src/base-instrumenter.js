import path from 'path';

import mustache from 'mustache';

import { write } from './util-fs';

export default class {
  prefix = '@@['

  suffix = ']@@'

  constructor(options) {
    this.options = options;
  }

  async instrument(file, { overwrite = false } = {}) {
    const relative = path.relative(this.options.rel, file);
    const data = await this.load(file);
    const nodes = await this.parse(data);

    nodes.forEach((node) => {
      this.inject(data, node, mustache.render(this.instrumentation, {
        prefix: this.prefix,
        suffix: this.suffix,
        name: node.name,
        file: relative,
      }));
    });

    const flushed = this.flush(data);
    if (overwrite) {
      await write(file, flushed);
    }

    return flushed;
  }
}
