/// <reference types="vite/client" />

// Ensure process.env is recognized for the SDK
// We extend the NodeJS namespace instead of declaring a global variable to avoid conflicts
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    [key: string]: string | undefined;
  }
}
