/* eslint-disable class-methods-use-this */

import jsonpath from 'jsonpath';
import flatten from 'lodash/flatten';

import BaseTracer from './base-instrumenter';
import { spawn } from './util-cp';
import { read } from './util-fs';

export default class extends BaseTracer {
  instrumentation = 'println!("{{{prefix}}} {{{file}}} {{{name}}} {{{suffix}}}");'

  async load(file) {
    const content = await read(file, { encoding: 'utf-8' });
    return { file, content };
  }

  async parse({ file, content }) {
    const ast = JSON.parse(await spawn('rustc', [
      '-Z',
      'ast-json-noexpand',
      file,
    ]));

    const fns = jsonpath.query(ast, '$..*[?(@.node.variant=="Fn")]');
    const impls = jsonpath.query(ast, '$..*[?(@.node.variant=="Impl")]');

    const functions = fns.map((fn) => {
      const fnName = fn.ident;
      const fnStmts = jsonpath.value(fn, '$.node.fields[?(@.stmts)]');

      return {
        name: fnName,
        span: fnStmts.span,
      };
    });

    const methods = flatten(impls.map((impl) => {
      const implPath = jsonpath.value(impl, '$.node.fields[?(@.node.variant=="Path")]');
      const implMethods = jsonpath.query(impl, '$.node.fields[*][?(@.node.variant=="Method")]');
      const pathName = content.substring(implPath.span.lo, implPath.span.hi);

      return implMethods.map((method) => {
        const methodName = method.ident;
        const methodStmts = jsonpath.value(method, '$.node.fields[?(@.stmts)]');

        return {
          name: `${pathName}::${methodName}`,
          span: methodStmts.span,
        };
      });
    }));

    return [...functions, ...methods].sort((a, b) => b.span.lo - a.span.lo);
  }

  inject(data, { span }, str) {
    const before = data.content.substring(0, span.lo + 1);
    const after = data.content.substring(span.lo + 1);
    // eslint-disable-next-line no-param-reassign
    data.content = before + str + after;
  }

  flush({ content }) {
    return content;
  }
}
