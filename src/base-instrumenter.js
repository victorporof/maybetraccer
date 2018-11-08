import mustache from 'mustache';

import { write } from './util';

export default class {
  prefix = '@@['

  suffix = ']@@'

  async instrument(path, { overwrite = false } = {}) {
    const data = await this.load(path);
    const nodes = await this.parse(data);

    nodes.forEach(({ name, span }) => {
      this.inject(data, span, mustache.render(this.instrumentation, {
        prefix: this.prefix,
        suffix: this.suffix,
        path,
        name,
      }));
    });

    const flushed = this.flush(data);
    if (overwrite) {
      await write(path, flushed);
    }

    return flushed;
  }
}
