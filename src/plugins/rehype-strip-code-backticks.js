import { visit } from 'unist-util-visit';

/** Remove stray backtick characters that Obsidian exports may leave inside <code>. */
export function rehypeStripCodeBackticks() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'code') return;

      const child = node.children?.[0];
      if (child?.type !== 'text' || typeof child.value !== 'string') return;

      const trimmed = child.value.replace(/^`+|`+$/g, '');
      if (trimmed !== child.value) {
        child.value = trimmed;
      }
    });
  };
}
