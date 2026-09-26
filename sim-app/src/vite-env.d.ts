interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly SSR: boolean;
  readonly PRESET: "web" | "app";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
