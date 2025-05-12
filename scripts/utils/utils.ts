export const trimIndent = (strings: TemplateStringsArray): string => {
  if (strings.length !== 1) {
    throw new Error('trimIndent must be called with a single string literal');
  }

  const lines = strings[0]!.split('\n');

  const trimmedLines = lines.slice(
    lines.findIndex(line => line.trim() !== ''),
    lines.length - lines.slice().reverse().findIndex(line => line.trim() !== ''),
  )

  const minIndent = Math.min(
    ...trimmedLines.filter(line => line.trim() !== '').map(line => line.match(/^(\s*)/)![1]!.length),
  );

  return trimmedLines.map(line => line.slice(minIndent)).join('\n');
};
