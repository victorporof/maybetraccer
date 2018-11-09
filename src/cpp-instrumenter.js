/* eslint-disable class-methods-use-this */
/* eslint-disable no-continue */

import path from 'path';

import balanced from 'balanced-match';

import * as logging from './util-logging';
import BaseTracer from './base-instrumenter';
import { spawn } from './util-cp';
import { read } from './util-fs';

const FN_RE = /^(?<nesting>[\s|]+)`?-(?<info>(?:FunctionDecl|CXXMethodDecl|CXXConstructorDecl|CXXDestructorDecl).*<line:(?<beginLine>\d+):(?<beginCol>\d+),\s(?:line:(?<endLine>\d+):(?<endCol>\d+)|col:(?<endColWithoutLine>\d+))>.*)(?<subtree>(?:\n\k<nesting>\s+.*)*)/gm;
const STRINGS_RE = /"(?:\\[^]|[^"\\\r\n])*"|'(?:\\[^]|[^'\\\r\n])+'|(?:R"(?<delim>[^()\s]*)\([^]*\)\k<delim>")/gm;
const COMMENTS_RE = /\/\/.*|\/\*[^]*?\*\//gm;
const CURLY_RE = /{|}/g;

export default class extends BaseTracer {
  instrumentation = 'printf("{{{prefix}}} {{{file}}} %s {{{suffix}}}\\n", {{{name}}});'

  async load(file) {
    const content = await read(file, { encoding: 'utf-8' });
    const lines = content.split('\n');
    return { file, content, lines };
  }

  async parse({ file, lines }) {
    const resolved = path.resolve(file);

    const ast = await spawn(this.options.clang, [
      resolved,
      '-ast-dump',
      '--',
      '-x', 'c++',
      '-fdiagnostics-color=never',
    ]);

    const nodes = [];
    let match;

    // eslint-disable-next-line no-cond-assign
    while (match = FN_RE.exec(ast.substring(ast.indexOf(resolved)))) {
      const { subtree, info, endColWithoutLine } = match.groups;
      let { beginLine, beginCol } = match.groups;
      let { endLine, endCol } = match.groups;

      beginLine = +beginLine;
      beginCol = +beginCol;

      if (endColWithoutLine) {
        endLine = +beginLine;
        endCol = +endColWithoutLine;
      } else {
        endLine = +endLine;
        endCol = +endCol;
      }

      if (beginLine > endLine) {
        logging.warn(`Warning: ignoring malformed AST bounds in ${file}:${beginLine}..${endLine}`);
        continue;
      }
      if (beginLine >= lines.length || endLine >= lines.length) {
        logging.warn(`Warning: ignoring out of bounds AST bounds in ${file}:${beginLine}..${endLine}`);
        continue;
      }
      if (subtree.indexOf('CompoundStmt') === -1) {
        logging.warn(`Warning: ignoring empty compound statement\n  in ${file}\n  at \`${info}\`\n  on \`${lines[beginLine - 1].trim()}\``);
        continue;
      }

      const fnLines = lines.slice(beginLine - 1, endLine);
      if (fnLines.length === 1) {
        fnLines[0] = fnLines[0].substring(beginCol - 1);
      } else {
        fnLines[0] = fnLines[0].substring(beginCol - 1);
        fnLines[fnLines.length - 1] = fnLines[fnLines.length - 1].substring(0, endCol);
      }

      let fnSource = fnLines.join('\n');
      fnSource = fnSource.replace(STRINGS_RE, s => s.replace(CURLY_RE, ' '));
      fnSource = fnSource.replace(COMMENTS_RE, s => s.replace(CURLY_RE, ' '));

      nodes.push({
        name: '__PRETTY_FUNCTION__',
        span: {
          lo: { line: beginLine, col: beginCol },
          hi: { line: endLine, col: endCol },
          body: balanced.range('{', '}', fnSource),
        },
      });
    }

    return nodes.sort((a, b) => b.span.lo.line - a.span.lo.line);
  }

  inject({ lines }, { span }, str) {
    const fnLines = lines.slice(span.lo.line - 1, span.hi.line);
    const fnSource = fnLines.join('\n');

    const before = fnSource.substring(0, span.body[0] + span.lo.col);
    const after = fnSource.substring(span.body[0] + span.lo.col);

    const fnNewSource = before + str + after;
    const fnNewLines = fnNewSource.split('\n');
    lines.splice(span.lo.line - 1, span.hi.line - span.lo.line + 1, ...fnNewLines);
  }

  flush({ lines }) {
    return lines.join('\n');
  }
}
