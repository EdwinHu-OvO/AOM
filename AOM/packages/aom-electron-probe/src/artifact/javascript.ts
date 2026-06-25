import { readFile } from "node:fs/promises";
import ts from "typescript";

export interface JavaScriptFacts {
  imports: string[];
  apiPaths: string[];
  symbols: string[];
}

export async function inspectJavaScript(filePath: string): Promise<JavaScriptFacts> {
  const text = await readFile(filePath, "utf8");
  return inspectJavaScriptText(filePath, text);
}

export function inspectJavaScriptText(fileName: string, text: string): JavaScriptFacts {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const imports = new Set<string>();
  const apiPaths = new Set<string>();
  const symbols = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.add(node.moduleSpecifier.text);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
      symbols.add(node.name.text);
    }
    if (ts.isStringLiteralLike(node) && node.text.startsWith("/api/")) {
      apiPaths.add(node.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return {
    imports: [...imports].sort(),
    apiPaths: [...apiPaths].sort(),
    symbols: [...symbols].sort(),
  };
}
