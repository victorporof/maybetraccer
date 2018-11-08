/* eslint-disable class-methods-use-this */

import { extname } from 'path';

import temp from 'temp';

import BaseTracer from './base-instrumenter';
import * as util from './util';

const FN_RE = /(?:MethodDecl|ConstructorDecl|DestructorDecl).*<line:(\d+):(\d+).*>.*\n(?:.*(?:ParmVarDecl.*|DeclRefExpr.*|CtorInitializer[^\0]*?)\n)*(?:.*CompoundStmt.*(?:<line:(\d+):(\d+).*line:(\d+):(\d+)>|<col:(\d+).*col:(\d+)>))/gm;
const INCLUDE_RE = /^#include\s+.+$/gm;

export default class extends BaseTracer {
  instrumentation = 'printf("{{{prefix}}} {{{path}}} %s {{{suffix}}}\\n", {{{name}}});'

  async load(path) {
    const content = await util.read(path, { encoding: 'utf-8' });
    const lines = content.split('\n');
    return { path, content, lines };
  }

  async parse({ path, content }) {
    const sanitized = temp.path({ suffix: extname(path) });

    await util.write(sanitized, content.replace(INCLUDE_RE, ''));
    const ast = await util.spawn('clang++', [
      sanitized,
      '-Wno-everything',
      '-Xclang',
      '-ast-dump',
      '-fsyntax-only',
      '-fdiagnostics-color=never',

    ]);
    await util.unlink(sanitized);

    const nodes = [];
    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = FN_RE.exec(ast)) !== null) {
      const [,
        declLine, ,
        stmtLineLo, stmtColumnLo, stmtLineHi, stmtColumnHi,
        stmtOnlyColumnLo, stmtOnlyColumnHi,
      ] = match;

      let lo;
      let hi;

      if (stmtOnlyColumnLo && stmtOnlyColumnHi) {
        lo = { line: declLine, column: stmtOnlyColumnLo };
        hi = { line: declLine, column: stmtOnlyColumnHi };
      } else {
        lo = { line: stmtLineLo, column: stmtColumnLo };
        hi = { line: stmtLineHi, column: stmtColumnHi };
      }

      nodes.push({
        name: '__PRETTY_FUNCTION__',
        span: { lo, hi },
      });
    }

    return nodes.sort((a, b) => b.span.lo.line - a.span.lo.line);
  }

  inject({ lines }, span, str) {
    const before = lines[span.lo.line - 1].substring(0, span.lo.column);
    const after = lines[span.lo.line - 1].substring(span.lo.column);
    // eslint-disable-next-line no-param-reassign
    lines[span.lo.line - 1] = before + str + after;
  }

  flush({ lines }) {
    return lines.join('\n');
  }
}
