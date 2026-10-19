// Font files imported as bytes by the browser build (esbuild's binary loader).
declare module "*.woff" {
  const data: Uint8Array;
  export default data;
}
