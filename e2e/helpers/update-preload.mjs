import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";

const options = JSON.parse(process.env.KONSISTENT_TEST_UPDATE);

Date.now = () => options.now;
Object.defineProperty(process.stdin, "isTTY", { value: true });
globalThis.fetch = (url) => {
  if (url !== "https://registry.npmjs.org/konsistent") {
    throw new Error(`Unexpected test request: ${url}`);
  }
  console.error("[test-registry]");
  return Promise.resolve(Response.json(options.metadata));
};
childProcess.execSync = (command) => {
  console.error(`[test-install] ${command}`);
  return null;
};
syncBuiltinESMExports();
