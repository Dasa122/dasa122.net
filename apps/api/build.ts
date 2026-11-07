await Bun.build({
  entrypoints: ["src/index.ts"],
  minify: true,
  outdir: "dist",
  packages: "bundle",
  sourcemap: true,
  target: "bun",
});

export {};
