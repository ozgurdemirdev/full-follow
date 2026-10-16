/**
 * A markdown image in a reply becomes a plain link: loading it would send a request to any address the reply names, and a
 * reply can carry text a web page or a record planted (the address can hold data read from the database).
 */
export function LinkedImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  const href = typeof src === "string" ? src : undefined;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {alt || href}
    </a>
  );
}
