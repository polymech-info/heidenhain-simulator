import path from "path";
import { fileURLToPath } from "url";
import { rspack } from "@rspack/core";
import { ReactRefreshRspackPlugin } from "@rspack/plugin-react-refresh";
import { writeSampleIndex } from "./write-sample-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleDir = path.resolve(__dirname, "../samples");
writeSampleIndex();

export default (env = {}, argv = {}) => {
  const isDev = argv.mode !== "production";

  return {
    target: "web",
    entry: path.resolve(__dirname, "src/main.tsx"),
    output: {
      path: path.resolve(__dirname, "dist"),
      publicPath: "/",
      filename: "heidenhain.bundle.js",
      chunkFilename: "heidenhain.[name].js",
      assetModuleFilename: "heidenhain.[name][ext]",
      clean: true,
    },
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
      modules: [path.resolve(__dirname, "node_modules"), "node_modules"],
      alias: {
        "@": path.resolve(__dirname, "src"),
        three: path.resolve(__dirname, "node_modules/three"),
        // Exact `zustand` only — keep `zustand/vanilla` and `zustand/react` on v5.
        zustand$: path.resolve(__dirname, "src/zustand-compat.js"),
      },
      fallback: { crypto: false, path: false },
    },
    module: {
      parser: {
        javascript: {
          exportsPresence: "warn",
        },
      },
      rules: [
        {
          test: /\.[jt]sx?$/,
          include: [path.resolve(__dirname, "src")],
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: { syntax: "typescript", tsx: true },
              transform: {
                react: {
                  runtime: "automatic",
                  development: isDev,
                  refresh: isDev,
                },
              },
              target: "es2022",
            },
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
      ],
    },
    plugins: [
      new rspack.DefinePlugin({
        "import.meta.env": JSON.stringify({
          DEV: isDev,
          PROD: !isDev,
          MODE: isDev ? "development" : "production",
          SSR: false,
        }),
        "import.meta.env.DEV": JSON.stringify(isDev),
        "import.meta.env.PROD": JSON.stringify(!isDev),
        "import.meta.env.MODE": JSON.stringify(isDev ? "development" : "production"),
        "import.meta.env.SSR": JSON.stringify(false),
      }),
      new rspack.HtmlRspackPlugin({
        template: path.resolve(__dirname, "index.html"),
        filename: "index.html",
        inject: "body",
        title: isDev ? "Heidenhain (dev)" : "Heidenhain",
        minify: !isDev,
      }),
      new rspack.NormalModuleReplacementPlugin(/^zustand$/, path.resolve(__dirname, "src/zustand-compat.js")),
      !isDev &&
        new rspack.CopyRspackPlugin({
          patterns: [{ from: sampleDir, to: "samples", globOptions: { ignore: ["**/.git/**"] } }],
        }),
      isDev && new ReactRefreshRspackPlugin(),
    ].filter(Boolean),
    devtool: isDev ? "eval-source-map" : false,
    performance: { hints: false },
    optimization: {
      splitChunks: isDev ? false : { chunks: "async" },
      runtimeChunk: false,
    },
    devServer: isDev
      ? {
          port: 5183,
          hot: true,
          open: "/?theme=dark",
          allowedHosts: "all",
          headers: { "Access-Control-Allow-Origin": "*" },
          static: {
            directory: sampleDir,
            publicPath: "/samples",
            watch: true,
          },
          historyApiFallback: {
            disableDotRule: true,
            htmlAcceptHeaders: ["text/html", "application/xhtml+xml"],
          },
        }
      : undefined,
  };
};
