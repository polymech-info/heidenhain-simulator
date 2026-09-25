import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { rspack } from "@rspack/core";
import { ReactRefreshRspackPlugin } from "@rspack/plugin-react-refresh";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (env = {}, argv = {}) => {
  const isDev = argv.mode !== "production";

  return {
    target: "web",
    entry: path.resolve(__dirname, "src/main.tsx"),
    output: {
      path: path.resolve(__dirname, "dist"),
      publicPath: "auto",
      filename: "3d-wrapper.bundle.js",
      chunkFilename: "3d-wrapper.[name].js",
      assetModuleFilename: "3d-wrapper.[name][ext]",
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
        title: isDev ? "WS212 wrapper (dev)" : "WS212 wrapper",
        minify: !isDev,
      }),
      new rspack.NormalModuleReplacementPlugin(
        /^zustand$/,
        path.resolve(__dirname, "src/zustand-compat.js"),
      ),
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
          setupMiddlewares: (middlewares, devServer) => {
            const repoRoot = path.resolve(__dirname, "../..");
            devServer.app.use("/dev-file", (req, res) => {
              const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : req.url;
              const raw = new URLSearchParams(qs).get("path") ?? "";
              if (!raw) {
                res.statusCode = 400;
                res.end("Missing ?path=");
                return;
              }
              const abs = path.resolve(repoRoot, raw);
              const guard = repoRoot + path.sep;
              if (!abs.startsWith(guard) && abs !== repoRoot) {
                res.statusCode = 403;
                res.end("Forbidden");
                return;
              }
              fs.readFile(abs, (err, data) => {
                if (err) {
                  res.statusCode = 404;
                  res.end("Not found");
                  return;
                }
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(data);
              });
            });
            return middlewares;
          },
        }
      : undefined,
  };
};
