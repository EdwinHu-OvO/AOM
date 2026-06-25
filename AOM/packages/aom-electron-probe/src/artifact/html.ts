export interface HtmlFacts {
  scripts: string[];
  stylesheets: string[];
}

export function inspectHtml(text: string): HtmlFacts {
  return {
    scripts: uniqueMatches(text, /<script[^>]+src=["']([^"']+)/gi),
    stylesheets: uniqueMatches(text, /<link[^>]+href=["']([^"']+)/gi),
  };
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  return [
    ...new Set(
      [...text.matchAll(pattern)]
        .map((match) => match[1])
        .filter((value): value is string => value !== undefined),
    ),
  ].sort();
}
