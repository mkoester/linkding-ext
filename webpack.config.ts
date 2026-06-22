import path from "path";
import { fileURLToPath } from "url";
import CopyPlugin from "copy-webpack-plugin";
import { merge } from "webpack-merge";
import type { Configuration } from "webpack";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shared: Configuration = {
  mode: "development",
  devtool: "cheap-module-source-map",
  entry: {
    background: "./src/background/background.ts",
    newtab: "./src/newtab/newtab.ts",
    popup: "./src/popup/popup.ts",
    options: "./src/options/options.ts",
  },
  output: {
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
};

export default (env: { browser: "chrome" | "firefox" }): Configuration => {
  const browser = env?.browser ?? "chrome";
  const outDir = path.resolve(__dirname, `dist/${browser}`);

  return merge(shared, {
    output: {
      path: outDir,
      filename: "[name].js",
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: "src/newtab/newtab.html", to: "newtab/newtab.html" },
          { from: "src/popup/popup.html", to: "popup/popup.html" },
          { from: "src/options/options.html", to: "options/options.html" },
          { from: "public/icons", to: "icons" },
          {
            from: `manifests/manifest.${browser}.json`,
            to: "manifest.json",
          },
        ],
      }),
    ],
  });
};
